// TodoList.jsx — per-show to-do list

import React, { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

export default function TodoList({ show, readOnly }) {
  const [input, setInput] = useState('')
  const todos = show.todos || []

  async function saveTodos(updated) {
    await updateDoc(doc(db, 'shows', show.id), { todos: updated, updatedAt: serverTimestamp() })
  }

  function addTodo() {
    const text = input.trim()
    if (!text) return
    saveTodos([...todos, { id: `todo-${Date.now()}`, text, done: false }])
    setInput('')
  }

  function toggleTodo(id) {
    saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTodo(id) {
    saveTodos(todos.filter(t => t.id !== id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') addTodo()
  }

  const doneCount = todos.filter(t => t.done).length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 pb-3 mb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">To Do List</h2>
        {todos.length > 0 && (
          <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
            {doneCount}/{todos.length} done
          </span>
        )}
      </div>

      {/* Add task input — admin only */}
      {!readOnly && (
        <div className="flex gap-2 mb-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a task and press Enter…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={addTodo}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Task list */}
      {todos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          {readOnly ? 'No tasks added yet.' : 'No tasks yet — add one above.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {todos.map(todo => (
            <li
              key={todo.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group transition-colors"
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => !readOnly && toggleTodo(todo.id)}
                disabled={readOnly}
                className="w-4 h-4 accent-amber-500 flex-shrink-0 cursor-pointer disabled:opacity-60"
              />
              <span className={`flex-1 text-sm ${todo.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {todo.text}
              </span>
              {!readOnly && (
                <button
                  onClick={() => deleteTodo(todo.id)}
                  title="Delete task"
                  className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm font-bold leading-none"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
