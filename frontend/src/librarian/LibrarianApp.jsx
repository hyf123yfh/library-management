import { useState, useEffect } from 'react'
import LibrarianLogin from './LibrarianLogin'
import LibrarianRegister from './LibrarianRegister'
import LibrarianDashboard from './LibrarianDashboard'
import BookManagement from './BookManagement'

function LibrarianApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [librarian, setLibrarian] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    const token = localStorage.getItem('librarianToken')
    const savedLibrarian = localStorage.getItem('librarianInfo')

    if (token && savedLibrarian) {
      setIsLoggedIn(true)
      setLibrarian(JSON.parse(savedLibrarian))
    }
  }, [])

  const handleLogin = (user, token) => {
    localStorage.setItem('librarianToken', token)
    localStorage.setItem('librarianInfo', JSON.stringify(user))
    setIsLoggedIn(true)
    setLibrarian(user)
    setShowRegister(false)
    setCurrentPage('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('librarianToken')
    localStorage.removeItem('librarianInfo')
    setIsLoggedIn(false)
    setLibrarian(null)
    setCurrentPage('dashboard')
  }

  const handleRegisterSuccess = () => {
    setShowRegister(false)
  }

  if (!isLoggedIn) {
    if (showRegister) {
      return (
        <LibrarianRegister
          onRegister={handleRegisterSuccess}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      )
    }
    return (
      <LibrarianLogin
        onLogin={handleLogin}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    )
  }

  if (currentPage === 'books') {
    return <BookManagement onBack={() => setCurrentPage('dashboard')} />
  }

  return (
    <LibrarianDashboard 
      librarian={librarian} 
      onLogout={handleLogout}
      onNavigateToBooks={() => setCurrentPage('books')}
    />
  )
}

export default LibrarianApp