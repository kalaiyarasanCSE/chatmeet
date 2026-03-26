# 💬 ChatMeet — Real-time Chat Rooms

A real-time chat application where users can create or join rooms instantly. No sign-up required.

🌐 **Live Demo:** [https://kalaiyarasancse.github.io/chatmeet](https://kalaiyarasancse.github.io/chatmeet)

---

## ✨ Features

- 🏠 Create a room with a unique 4-digit code
- 🔑 Join any room using the room code
- 💬 Real-time messaging with Socket.IO
- 😀 Emoji picker
- 📎 File & image sharing (max 5MB)
- ↩️ Reply to messages
- 👍 Message reactions (👍 ❤️ 😂 😮 😢 🔥)
- 📋 Copy messages
- 🔍 Search messages & participants
- 🖼️ Image lightbox viewer
- ✏️ Typing indicator
- 👑 Host controls — mute / kick users
- 🟢 Online / Away status
- 🔔 Unread message badge on tab
- 💾 Chat history restored on page refresh
- 📱 Responsive design

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Hosting (client) | GitHub Pages |
| Hosting (server) | Render.com |

---

## 📁 Project Structure

```
chatmeet/
├── client/
│   ├── index.html      # Home / Join page
│   ├── create.html     # Create room page
│   ├── room.html       # Chat room page
│   ├── chat.js         # All chat logic
│   └── style.css       # All styles
├── server/
│   ├── server.js       # Node.js + Socket.IO server
│   └── package.json
└── README.md
```

---

## 🚀 Run Locally

**1. Clone the repo**
```bash
git clone https://github.com/kalaiyarasanCSE/chatmeet.git
cd chatmeet
```

**2. Start the server**
```bash
cd server
npm install
node server.js
```

**3. Open the client**

Open `client/index.html` in your browser using Live Server (VS Code extension) or any local server.

---

## 🌍 Deployment

| Service | Purpose | URL |
|---------|---------|-----|
| GitHub Pages | Frontend hosting | [kalaiyarasancse.github.io/chatmeet](https://kalaiyarasancse.github.io/chatmeet) |
| Render.com | Backend server | [chatmeet-server.onrender.com](https://chatmeet-server.onrender.com) |

---

## 📸 Screenshots

> Home Page — Create or join a room

> Chat Room — Real-time messaging with reactions and replies

---

## 👨‍💻 Author

**Kalaiyarasan**
- GitHub: [@kalaiyarasanCSE](https://github.com/kalaiyarasanCSE)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
