import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import CreateDepartmentForm from '../components/departments/CreateDepartmentForm';

export default function DepartmentsView({ onNavigate }) {
  const { userProfile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'departments'),
      where('orgId', '==', orgId)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDepartments(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading departments...</div>;
  }

  if (showForm) {
    return (
      <div className="p-6 max-w-4xl">
        <button
          onClick={() => setShowForm(false)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
        >
          ← Back to Departments
        </button>
        <CreateDepartmentForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Departments</h1>
          <p className="text-sm text-gray-500">Organize your venues, productions, and people by team.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add Department
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No departments yet.</p>
          <p className="text-gray-400 text-sm">Add your first department to start organizing your team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => onNavigate && onNavigate(`departments/${dept.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: dept.colorCode || '#6366f1' }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{dept.name}</p>
                  {dept.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{dept.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
