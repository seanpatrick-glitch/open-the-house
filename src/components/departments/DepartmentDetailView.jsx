import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getDisplayName } from '../../utils/displayName';

// Places and productions are not linked to departments anywhere in the data
// model today (checked models/org.js, models/productions.js, and the place
// document's own write shape in CreatePlaceForm.jsx) — no section for that
// relationship is rendered here rather than fabricating one.

export default function DepartmentDetailView({ department, onBack, onViewTimeline }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;

  const [head, setHead]         = useState(null);
  const [members, setMembers]   = useState([]);
  const [taskStats, setTaskStats] = useState({ total: 0, complete: 0 });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!orgId || !department?.id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const headPromise = department.departmentHeadUid
        ? getDoc(doc(db, 'organizations', orgId, 'members', department.departmentHeadUid))
        : Promise.resolve(null);

      const typesPromise = getDocs(query(
        collection(db, 'organizations', orgId, 'personTypes'),
        where('departmentId', '==', department.id)
      ));

      const tasksPromise = getDocs(query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('departmentId', '==', department.id)
      ));

      const [headSnap, typesSnap, tasksSnap] = await Promise.all([headPromise, typesPromise, tasksPromise]);

      const typeIds = typesSnap.docs.map(d => d.id);
      let peopleList = [];
      if (typeIds.length > 0) {
        const peopleSnaps = await Promise.all(typeIds.map(typeId =>
          getDocs(query(
            collection(db, 'organizations', orgId, 'people'),
            where('typeId', '==', typeId),
            where('status', '==', 'active')
          ))
        ));
        peopleList = peopleSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      const tasks = tasksSnap.docs.map(d => d.data());

      if (cancelled) return;
      setHead(headSnap?.exists() ? { uid: headSnap.id, ...headSnap.data() } : null);
      setMembers(peopleList);
      setTaskStats({
        total:    tasks.length,
        complete: tasks.filter(t => t.status === 'complete').length,
      });
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [orgId, department?.id, department?.departmentHeadUid]);

  const pct = taskStats.total > 0 ? Math.round((taskStats.complete / taskStats.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Departments
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: department.colorCode || '#6366f1' }}
          />
          <h1 className="text-2xl font-bold text-gray-900">{department.name}</h1>
        </div>
        {department.description && (
          <p className="text-sm text-gray-500">{department.description}</p>
        )}
      </div>

      {/* Department Head */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Department Head</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : head ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{getDisplayName(head) || 'No name'}</p>
            {head.email && <p className="text-xs text-gray-500 mt-0.5">{head.email}</p>}
          </div>
        ) : department.departmentHeadEmail ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-600">Invited: {department.departmentHeadEmail}</p>
            <p className="text-xs text-gray-400 mt-0.5">Not yet accepted.</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-400">No department head assigned.</p>
          </div>
        )}
      </section>

      {/* Task progress + jump to filtered Timeline */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Tasks</h2>
          <button
            onClick={onViewTimeline}
            className="text-xs font-medium text-places-blue hover:text-places-blue/90 transition-colors"
          >
            View in Timeline →
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : taskStats.total === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No tasks linked to this department yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-600 mb-2">{taskStats.complete} of {taskStats.total} tasks complete</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: department.colorCode || '#6366f1' }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Members: people whose person type has this department set */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Members</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : members.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No people assigned to this department yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {members.map(person => (
              <div key={person.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{getDisplayName(person) || 'No name'}</p>
                  <p className="text-xs text-gray-400">{person.typeLabel}</p>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-gray-500">
                  {person.fieldValues?.email && <p className="truncate max-w-[200px]">{person.fieldValues.email}</p>}
                  {person.fieldValues?.phone && <p>{person.fieldValues.phone}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
