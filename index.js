const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 14 }
}));

let userActivity = {};

setInterval(() => {
  const now = Date.now();
  for (const userId in userActivity) {
    if (now - userActivity[userId].startTime > 60000) {
      delete userActivity[userId];
    }
  }
}, 1000 * 10);

const blackList = ['/trackings', '/track'];

app.use((req, res, next) => {
  if (blackList.includes(req.originalUrl)) return next();

  if (!req.session.userId) {
    req.session.userId = `user-${Date.now()}`;
  }

  if (!userActivity[req.session.userId]) {
    userActivity[req.session.userId] = {
      startTime: Date.now(),
      currentPage: req.originalUrl,
      duration: 0
    };
  } else {
    userActivity[req.session.userId].currentPage = req.originalUrl;
    userActivity[req.session.userId].duration = (Date.now() - userActivity[req.session.userId].startTime) / 1000 / 60; 
  }

  next();
});

app.use((req, res, next) => {
  if (blackList.includes(req.originalUrl)) return next();
  const originalSend = res.send;
  res.send = function(body) {
    if (typeof body === 'string') {
      body += `
        <script>
          function track() {
            const userId = '${req.session.userId}';
            const currentPage = window.location.pathname;
            fetch('/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ userId, currentPage })
            });
          }
          window.addEventListener('load', track);
          setInterval(track, 3000);
        </script>
      `;
    }
    return originalSend.call(this, body);
  };
  next();
});

app.post('/track', (req, res) => {
  const { userId, currentPage } = req.body;

  if (userActivity[userId]) {
    userActivity[userId].currentPage = currentPage;
    userActivity[userId].duration = (Date.now() - userActivity[userId].startTime) / 1000 / 60; 
  }

  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Home Page</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-100 text-gray-800">
        <div class="container mx-auto p-4">
          <h1 class="text-2xl font-bold mb-4">Home Page</h1>
          <p>Welcome to the Home Page!</p>
          <p class="mt-4">Hello ${req.session.userId}</p>
          <a href="/about" class="block mt-4 text-blue-500">About Page</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/about', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>About Page</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-100 text-gray-800">
        <div class="container mx-auto p-4">
          <h1 class="text-2xl font-bold mb-4">About Page</h1>
          <p>Welcome to the About Page!</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/trackings', (req, res) => {
  res.json(userActivity);
});

app.get('/admin', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Admin Panel</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-100 text-gray-800">
        <div class="container mx-auto p-4">
          <h1 class="text-2xl font-bold mb-4">Admin Panel, Hello ${req.session.userId}</h1>
          <ul id="users" class="list-none p-0"></ul>
          <script> 
            function getUsers() {
              fetch('/trackings')
                .then(res => res.json())
                .then(data => {
                  const users = document.getElementById('users');
                  users.innerHTML = '';
                  for (const userId in data) {
                    const li = document.createElement('li');
                    li.classList.add('mb-2', 'p-2', 'border', 'rounded', 'bg-white');
                    li.innerText = userId + ' - ' + data[userId].currentPage + ' - ' + data[userId].duration.toFixed(2) + ' minutes';
                    users.appendChild(li);
                  }
                });
            }
            window.addEventListener('load', getUsers);
            setInterval(getUsers, 5000);
          </script>
        </div>
      </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
