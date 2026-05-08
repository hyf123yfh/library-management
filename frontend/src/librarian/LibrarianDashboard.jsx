import { useState } from 'react'
import LibrarianMessages from './LibrarianMessages'

export default function LibrarianDashboard({ librarian, onLogout, onNavigateToBooks }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('borrow')
  
  // 借阅相关状态
  const [studentSearch, setStudentSearch] = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [bookSearch, setBookSearch] = useState('')
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  
  // 归还相关状态
  const [returnSearch, setReturnSearch] = useState('')
  const [returnLoans, setReturnLoans] = useState([])
  const [returnSearched, setReturnSearched] = useState(false)

  // 搜索学生
  const searchStudents = async () => {
    if (!studentSearch.trim()) return
    setLoading(true)
    const token = localStorage.getItem('librarianToken')
    try {
      const res = await fetch(`http://localhost:3001/loans/users/search?keyword=${studentSearch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setStudents(data.users || [])
    } catch (err) {
      setMessage('搜索失败')
    }
    setLoading(false)
  }
  
  // 搜索图书
  const searchBooks = async () => {
    if (!bookSearch.trim()) return
    setLoading(true)
    const token = localStorage.getItem('librarianToken')
    try {
      const res = await fetch(`http://localhost:3001/loans/books/search?keyword=${bookSearch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setBooks(data.books || [])
    } catch (err) {
      setMessage('搜索失败')
    }
    setLoading(false)
  }
  
  // 借出图书
  const handleLend = async () => {
    if (!selectedStudent || !selectedBook) {
      setMessage('请选择学生和图书')
      return
    }
    setLoading(true)
    const token = localStorage.getItem('librarianToken')
    try {
      const res = await fetch('http://localhost:3001/loans/lend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedStudent.id,
          bookId: selectedBook.id
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`借阅成功！${selectedBook.title} 借给 ${selectedStudent.name}`)
        setSelectedStudent(null)
        setSelectedBook(null)
        setStudents([])
        setBooks([])
        setStudentSearch('')
        setBookSearch('')
      } else {
        setMessage(data.message || '借阅失败')
      }
    } catch (err) {
      setMessage('借阅失败')
    }
    setLoading(false)
  }
  
  // 按用户信息搜索借阅记录
  const searchUserLoans = async () => {
    if (!returnSearch.trim()) return
    setLoading(true)
    setReturnSearched(true)
    const token = localStorage.getItem('librarianToken')
    try {
      const res = await fetch(`http://localhost:3001/loans/search-loans?keyword=${encodeURIComponent(returnSearch)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setReturnLoans(data.loans || [])
    } catch (err) {
      setMessage('搜索失败')
    }
    setLoading(false)
  }

  // 通过 loanId 归还
  const handleReturnByLoanId = async (loanId) => {
    setLoading(true)
    const token = localStorage.getItem('librarianToken')
    try {
      const res = await fetch('http://localhost:3001/loans/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ loanId })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`归还成功！`)
        setReturnSearch('')
        setReturnLoans([])
        setReturnSearched(false)
      } else {
        setMessage(data.message || '归还失败')
      }
    } catch (err) {
      setMessage('归还失败')
    }
    setLoading(false)
  }
  
  const handleLogout = () => {
    localStorage.removeItem('librarianToken')
    localStorage.removeItem('librarianInfo')
    if (onLogout) onLogout()
  }
  
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📚</div>
            <h1 className="text-xl font-bold text-gray-800">图书馆管理系统</h1>
            <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">图书管理员</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{getGreeting()}</p>
              <p className="font-semibold text-gray-800">{librarian?.name}</p>
              <p className="text-xs text-gray-400">工号：{librarian?.employeeId}</p>
            </div>
            <button onClick={() => setShowConfirm(true)} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm">
              退出登录
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">{getGreeting()}，{librarian?.name}！</h2>
          <p className="opacity-90">欢迎回来，您可以通过下方功能管理图书馆系统。</p>
        </div>
        
        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
            <div className="text-4xl mb-4">📖</div>
            <h2 className="text-xl font-bold mb-2">借阅管理</h2>
            <p className="text-gray-500 text-sm mb-4">借书、还书操作</p>
            <button onClick={() => setActiveTab('borrow')} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              借书
            </button>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
            <div className="text-4xl mb-4">↩️</div>
            <h2 className="text-xl font-bold mb-2">归还管理</h2>
            <p className="text-gray-500 text-sm mb-4">处理图书归还</p>
            <button onClick={() => setActiveTab('return')} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              还书
            </button>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-bold mb-2">图书管理</h2>
            <p className="text-gray-500 text-sm mb-4">添加、编辑、删除图书</p>
            <button onClick={onNavigateToBooks} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              进入 →
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-xl font-bold mb-2">消息回复</h2>
            <p className="text-gray-500 text-sm mb-4">查看读者留言并直接回复</p>
            <button onClick={() => setActiveTab('messages')} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              打开消息
            </button>
          </div>
        </div>
        
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}
        
        {/* 借阅图书界面 */}
        {activeTab === 'borrow' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">👤 选择学生</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="输入学号或邮箱"
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button onClick={searchStudents} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  搜索
                </button>
              </div>
              {students.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                  {students.map(s => (
                    <div key={s.id} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedStudent?.id === s.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`} onClick={() => setSelectedStudent(s)}>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-gray-500">学号: {s.studentId} | 邮箱: {s.email}</p>
                      <p className="text-xs">当前借阅: {s.currentBorrowCount}/3 | {s.hasOverdue ? '⚠️ 有逾期' : '✅ 正常'}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-700">✅ 已选择: {selectedStudent.name}</p>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">📚 选择图书</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="输入书名或ISBN"
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button onClick={searchBooks} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  搜索
                </button>
              </div>
              {books.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                  {books.map(b => (
                    <div key={b.id} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedBook?.id === b.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`} onClick={() => setSelectedBook(b)}>
                      <p className="font-medium">{b.title}</p>
                      <p className="text-sm text-gray-500">作者: {b.author} | 剩余: {b.availableCopies}/{b.totalCopies}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedBook && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-700">✅ 已选择: {selectedBook.title}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 借出按钮 */}
        {activeTab === 'borrow' && selectedStudent && selectedBook && (
          <div className="mt-6 flex justify-center">
            <button onClick={handleLend} disabled={loading} className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 text-lg font-semibold">
              {loading ? '处理中...' : '📖 确认借出'}
            </button>
          </div>
        )}
        
        {/* 归还图书界面 */}
        {activeTab === 'return' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold mb-4">↩️ 归还图书</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">学号 / 姓名 / 邮箱</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  placeholder="输入学号、姓名或邮箱"
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button onClick={searchUserLoans} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  搜索
                </button>
              </div>
            </div>
            
            {returnLoans.length > 0 && (
              <div className="mt-4 border rounded-lg divide-y">
                {returnLoans.map(loan => (
                  <div key={loan.id} className="p-3 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <p className="font-medium">{loan.copy?.book?.title || '未知图书'}</p>
                      <p className="text-sm text-gray-500">
                        借阅人: {loan.user?.name} ({loan.user?.studentId})<br/>
                        借书日期: {new Date(loan.checkoutDate).toLocaleDateString()} | 应还日期: {new Date(loan.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => handleReturnByLoanId(loan.id)} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600">
                      确认归还
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {returnSearched && returnLoans.length === 0 && (
              <p className="text-center text-gray-500 mt-4">未找到借阅记录</p>
            )}
          </div>
        )}

        {activeTab === 'messages' && <LibrarianMessages />}
      </main>
      
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-bold mb-4">确认退出</h3>
            <p className="text-gray-600 mb-6">确定要退出登录吗？</p>
            <div className="flex gap-3">
              <button onClick={handleLogout} className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600">确定</button>
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}