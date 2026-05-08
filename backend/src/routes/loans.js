const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireLibrarianAuth } = require('../middleware/librarianAuth');

const router = express.Router();

const MAX_BORROW_LIMIT = 3;      // 学生最多借3本
const LOAN_DURATION_DAYS = 30;   // 借期30天

// 辅助函数：获取学生当前借阅数量（未归还）
async function getCurrentBorrowCount(userId) {
  return await prisma.loan.count({
    where: {
      userId,
      returnDate: null
    }
  });
}

// 辅助函数：检查学生是否有逾期未还的图书
async function hasOverdueLoans(userId) {
  const count = await prisma.loan.count({
    where: {
      userId,
      returnDate: null,
      dueDate: { lt: new Date() }
    }
  });
  return count > 0;
}

// 1. 搜索学生（馆员/管理员专用）- 使用馆员认证
router.get('/users/search', requireLibrarianAuth, async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { studentId: { contains: keyword } },
          { email: { contains: keyword.toLowerCase() } }
        ],
        role: 'STUDENT'
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        role: true
      },
      take: 20
    });

    const usersWithStatus = await Promise.all(users.map(async (user) => {
      const currentCount = await getCurrentBorrowCount(user.id);
      const hasOverdue = await hasOverdueLoans(user.id);
      return {
        ...user,
        currentBorrowCount: currentCount,
        hasOverdue,
        canBorrow: (currentCount < MAX_BORROW_LIMIT) && !hasOverdue
      };
    }));

    res.json({ users: usersWithStatus });
  } catch (error) {
    next(error);
  }
});

// 2. 搜索图书（馆员/管理员专用）- 使用馆员认证，通过副本统计数量
router.get('/books/search', requireLibrarianAuth, async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const books = await prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { isbn: { contains: keyword } }
        ]
      },
      include: {
        copies: {
          where: { status: 'AVAILABLE' }
        }
      },
      take: 20
    });

    const booksWithCount = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      availableCopies: book.copies.length,
      totalCopies: book.copies.length
    }));

    res.json({ books: booksWithCount });
  } catch (error) {
    next(error);
  }
});

// 3. 馆员借出图书给学生 - 使用馆员认证
router.post('/lend', requireLibrarianAuth, async (req, res, next) => {
  try {
    const { userId, bookId } = req.body;
    if (!userId || !bookId) {
      return res.status(400).json({ message: 'userId and bookId are required' });
    }

    const student = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });
    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // 查找可借副本 - 修复：添加 include book
    const availableCopy = await prisma.copy.findFirst({
      where: {
        bookId: parseInt(bookId),
        status: 'AVAILABLE'
      },
      include: { book: true }
    });

    if (!availableCopy) {
      return res.status(400).json({ message: 'No available copies of this book' });
    }

    const existingLoan = await prisma.loan.findFirst({
      where: {
        userId: student.id,
        copy: { bookId: parseInt(bookId) },
        returnDate: null
      }
    });
    if (existingLoan) {
      return res.status(400).json({ message: 'Student already borrowed this book and not returned' });
    }

    const currentCount = await getCurrentBorrowCount(student.id);
    if (currentCount >= MAX_BORROW_LIMIT) {
      return res.status(400).json({ message: `Student has already borrowed ${MAX_BORROW_LIMIT} books. Cannot lend more.` });
    }
    const hasOverdue = await hasOverdueLoans(student.id);
    if (hasOverdue) {
      return res.status(400).json({ message: 'Student has overdue books. Please return them first.' });
    }

    const checkoutDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_DURATION_DAYS);

    const loan = await prisma.loan.create({
      data: {
        copyId: availableCopy.id,
        userId: student.id,
        checkoutDate,
        dueDate,
        fineAmount: 0,
        finePaid: false,
        fineForgiven: false,
        renewCount: 0
      }
    });

    await prisma.copy.update({
      where: { id: availableCopy.id },
      data: { status: 'BORROWED' }
    });

   
    res.status(201).json({
      message: 'Book lent successfully',
      loan: {
        id: loan.id,
        bookTitle: availableCopy.book.title,
        studentName: student.name,
        checkoutDate,
        dueDate
      }
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 4. 获取当前登录用户的个人借阅历史 - 使用读者认证
router.get('/my-history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const history = await prisma.loan.findMany({
      where: { userId: userId },
      include: {
        copy: {
          include: {
            book: {
              select: {
                title: true,
                author: true,
                isbn: true,
                genre: true,
              },
            },
          },
        },
      },
      orderBy: { checkoutDate: 'desc' },
    });

    const processedHistory = history.map(loan => {
      let status = 'ON_LOAN';
      if (loan.returnDate) {
        status = 'RETURNED';
      } else if (new Date(loan.dueDate) < new Date()) {
        status = 'OVERDUE';
      }
      return {
        ...loan,
        book: loan.copy?.book,
        status
      };
    });

    res.json(processedHistory);
  } catch (error) {
    next(error);
  }
});

// 5. 读者借阅图书 - 使用副本
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ message: '只有学生可以借书' });
    }

    const { copyId } = req.body;
    if (!copyId) {
      return res.status(400).json({ message: '请提供副本ID' });
    }

    const copy = await prisma.copy.findUnique({
      where: { id: parseInt(copyId) },
      include: { book: true }
    });

    if (!copy) {
      return res.status(404).json({ message: '副本不存在' });
    }
    if (copy.status !== 'AVAILABLE') {
      return res.status(400).json({ message: '该副本不可借' });
    }

    const existingLoan = await prisma.loan.findFirst({
      where: {
        userId: req.user.id,
        copy: { bookId: copy.bookId },
        returnDate: null
      }
    });
    if (existingLoan) {
      return res.status(400).json({ message: '您已借阅过这本书，请先归还' });
    }

    const currentCount = await prisma.loan.count({
      where: { userId: req.user.id, returnDate: null }
    });
    if (currentCount >= 3) {
      return res.status(400).json({ message: '最多同时借阅3本书' });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const loan = await prisma.loan.create({
      data: {
        copyId: copy.id,
        userId: req.user.id,
        dueDate: dueDate,
        fineAmount: 0,
        finePaid: false,
        fineForgiven: false,
        renewCount: 0
      }
    });

    await prisma.copy.update({
      where: { id: copy.id },
      data: { status: 'BORROWED' }
    });

    res.json({ message: '借阅成功', loan });
  } catch (error) {
    next(error);
  }
});

// 6. 还书功能 - 使用馆员认证
router.post('/return', requireLibrarianAuth, async (req, res, next) => {
  try {
    const { loanId } = req.body;
    
    if (!loanId) {
      return res.status(400).json({ message: '请提供借阅记录ID (loanId)' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: parseInt(loanId) },
      include: { copy: { include: { book: true } }, user: true }
    });

    if (!loan) {
      return res.status(404).json({ message: '借阅记录不存在' });
    }

    if (loan.returnDate !== null) {
      return res.status(400).json({ message: '这本书已经还过了' });
    }

    const today = new Date();
    const dueDate = new Date(loan.dueDate);
    let fineAmount = 0;
    
    if (today > dueDate) {
      const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
      const DAILY_FINE = 0.5;
      fineAmount = daysOverdue * DAILY_FINE;
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: parseInt(loanId) },
      data: {
        returnDate: today,
        fineAmount: fineAmount,
        finePaid: false,
      }
    });

    await prisma.copy.update({
      where: { id: loan.copyId },
      data: { status: 'AVAILABLE' }
    });

   
    res.json({
      message: '还书成功',
      loan: {
        id: updatedLoan.id,
        bookTitle: loan.copy.book.title,
        userName: loan.user.name,
        checkoutDate: loan.checkoutDate,
        dueDate: loan.dueDate,
        returnDate: updatedLoan.returnDate,
        fineAmount: updatedLoan.fineAmount,
        isOverdue: fineAmount > 0
      }
    });

  } catch (error) {
    next(error);
  }
});
// 7. 按用户信息查找借阅记录（馆员专用）
router.get('/search-loans', requireLibrarianAuth, async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({ message: '请输入学号、姓名或邮箱' });
    }

    // 先查找匹配的用户
    const users = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        OR: [
          { studentId: { contains: keyword } },
          { name: { contains: keyword } },
          { email: { contains: keyword.toLowerCase() } }
        ]
      },
      select: { id: true, name: true, email: true, studentId: true }
    });

    if (users.length === 0) {
      return res.json({ loans: [] });
    }

    // 查找这些用户的未归还借阅记录
    const loans = await prisma.loan.findMany({
      where: {
        userId: { in: users.map(u => u.id) },
        returnDate: null
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, studentId: true }
        },
        copy: {
          include: { book: { select: { id: true, title: true, author: true } } }
        }
      },
      orderBy: { checkoutDate: 'desc' }
    });

    res.json({ loans });
  } catch (error) {
    next(error);
  }
});

module.exports = router;