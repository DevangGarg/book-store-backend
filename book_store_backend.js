const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

// Database to store information
let users = [];
let books = [];
let purchaseHistory = [];
let authorRevenue = {};

// Secret key for JWT (replace this with a more secure key in production)
const JWT_SECRET = 'your_jwt_secret_key';

// User roles
const ROLES = {
  AUTHOR: 'Author',
  ADMIN: 'Admin',
  RETAIL_USER: 'Retail User',
};

// Middleware for user authentication
const authenticateUser = (req, res, next) => {
    const token = req.header('Authorization');
  
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded.user;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
  };

// Routes for User Management
app.post('/register', (req, res) => {
    const { username, password, role, email } = req.body;
    const user = { id: uuidv4(), username, password, role, email };
    users.push(user);
    res.status(201).json({ message: 'User registered successfully', user });
  });
  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find((u) => u.username === username && u.password === password);
  
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  
    const token = jwt.sign({ user: { id: user.id, username: user.username, role: user.role } }, JWT_SECRET, { expiresIn: '1h' });
  
    res.status(200).json({ message: 'User logged in successfully', token });
  });
  
  

// Routes for Book Management
app.post('/addBook', authenticateUser, (req, res) => {
  const { title, authors, description, price } = req.body;
  const bookId = `book-${uuidv4()}`;
  const sellCount = 0; // Initial sell count

  // Validate price within the specified range
  if (price < 100 || price > 1000) {
    return res.status(400).json({ error: 'Invalid price range' });
  }

  const newBook = { bookId, title, authors, description, price, sellCount };
  books.push(newBook);
  res.status(201).json({ message: 'Book added successfully', book: newBook });
});

// Routes for Purchase History
app.post('/purchase', authenticateUser, (req, res) => {
  const { bookId, quantity } = req.body;
  const userId = req.user.id;
  const purchaseId = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${uuidv4()}`;
  const book = books.find((b) => b.bookId === bookId);

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  // Update sell count
  book.sellCount += quantity;

  // Store purchase record
  const purchaseRecord = { purchaseId, bookId, userId, purchaseDate: new Date(), price: book.price, quantity };
  purchaseHistory.push(purchaseRecord);

  res.status(201).json({ message: 'Purchase successful', purchaseRecord });
});

app.get('/purchaseHistory', authenticateUser, (req, res) => {
  const userId = req.user.id;
  const userPurchaseHistory = purchaseHistory.filter((purchase) => purchase.userId === userId);
  res.status(200).json({ purchaseHistory: userPurchaseHistory });
});

// Routes for Revenue Tracking
app.post('/notifyAuthors', authenticateUser, (req, res) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const userId = req.user.id;

  // Calculate revenue for the current month and year
  const revenue = purchaseHistory
    .filter((purchase) => purchase.userId === userId && purchase.purchaseDate.getMonth() + 1 === currentMonth && purchase.purchaseDate.getFullYear() === currentYear)
    .reduce((totalRevenue, purchase) => totalRevenue + purchase.price * purchase.quantity, 0);

  // Update author's total revenue
  if (req.user.role === ROLES.AUTHOR) {
    const author = users.find((user) => user.id === userId);
    if (author) {
      authorRevenue[userId] = authorRevenue[userId] ? authorRevenue[userId] + revenue : revenue;

      // Send email notification to author
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'your-email@gmail.com',
          pass: 'your-email-password',
        },
      });

      const mailOptions = {
        from: 'your-email@gmail.com',
        to: author.email,
        subject: 'Monthly Revenue Update',
        text: `Dear ${author.username},\n\nYour revenue for ${currentMonth}/${currentYear} is ${revenue}.\n\nTotal revenue: ${authorRevenue[userId]}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

      res.status(200).json({ message: 'Notification sent successfully' });
    } else {
      res.status(404).json({ error: 'Author not found' });
    }
  } else {
    res.status(403).json({ error: 'Unauthorized access' });
  }
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
