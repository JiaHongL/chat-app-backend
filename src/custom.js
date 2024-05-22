// custom.js
window.onload = function() {
    const description = document.querySelector('.description');
    const websocketDescription = document.createElement('div');
    websocketDescription.innerHTML = `
      <h3>WebSocket Events</h3>
      <p>To connect to the WebSocket server, use the following URL:</p>
      <code>ws://localhost:3000</code>
      <h4>Available Events:</h4>
      <ul>
        <li>
          <strong>joinRoom</strong> - Join a chat room.
          <p>Example payload:</p>
          <pre>
  {
    "room": "general"
  }
          </pre>
          <p>This event will join the specified chat room. The room name should be a string.</p>
        </li>
        <li>
          <strong>message</strong> - Send a message to a room.
          <p>Example payload:</p>
          <pre>
  {
    "room": "general",
    "message": "Hello everyone!",
    "sender": "john_doe"
  }
          </pre>
          <p>This event will send a message to the specified room. The payload should include the room name, the message content, and the sender's username.</p>
        </li>
        <li>
          <strong>privateMessage</strong> - Send a private message to a user.
          <p>Example payload:</p>
          <pre>
  {
    "to": "jane_doe",
    "message": "Hi Jane!",
    "sender": "john_doe"
  }
          </pre>
          <p>This event will send a private message to the specified user. The payload should include the recipient's username, the message content, and the sender's username.</p>
        </li>
      </ul>
    `;
    description.appendChild(websocketDescription);
  };
  