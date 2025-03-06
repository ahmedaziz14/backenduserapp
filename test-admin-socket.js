const io = require('socket.io-client');

// Remplace par un token valide obtenu après signin admin
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZiNGM3MzM3LWJiZjAtNDBkNi1hMjhmLTFkOWNjYzU5NzE2ZSIsImVtYWlsIjoibWVzc2lAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQxMTA1NTk5LCJleHAiOjE3NDExMDkxOTl9.9xEggFSChBZZhE9zxEbobcfAGOrrS0rmzqL77Sjh7XU'; 
const socket = io('http://localhost:3001', {
  auth: { token },
});

socket.on('connect', () => {
  console.log('Admin connected to WebSocket');
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

socket.on('disconnect', () => {
  console.log('Admin disconnected');
});