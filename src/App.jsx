import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Home from './pages/Home'
import TodoList from './pages/TodoList'
import TodoDetail from './pages/TodoDetail'
import FileList from './pages/FileList'
import FileDetail from './pages/FileDetail'
import MessageDetail from './pages/MessageDetail'
import Layout from './components/Layout'
import MessageList from './pages/MessageList'
import Inventory from './pages/Inventory'
import Notes from './pages/Notes'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/home" />} />
            <Route path="home" element={<Home />} />
            <Route path="home/todos" element={<TodoList />} />
            <Route path="home/todos/:id" element={<TodoDetail />} />
            <Route path="home/files" element={<FileList />} />
            <Route path="home/files/:id" element={<FileDetail />} />
            <Route path="home/messages" element={<MessageList />} />
            <Route path="home/messages/:id" element={<MessageDetail />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="notes" element={<Notes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}