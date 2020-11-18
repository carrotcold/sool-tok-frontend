import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import format from 'date-fns/format';

// TODO: chatList.map key unique 한걸로 설정해주기.
// TODO: chatList visibility: hidden 설정해주기?
function Chat({ addChat, user, chatList, socket }) {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!socket) return;

    socket.on('recieve message', ({ chat }) => addChat(chat));

    return () => socket.off('recieve message');
  }, [socket]);

  const handleInputChange = ev => {
    const { value } = ev.target;

    setInput(value);
  };

  const handleMessageSubmit = ev => {
    ev.preventDefault();

    const time = format(new Date(), 'HH:mm');
    const newChat = {
      author: user.name,
      photoUrl: user.photoUrl,
      content: input,
      date: time,
    };

    socket.emit('send message', ({ chat: newChat }));

    setInput('');
  };

  return (
    <div style={{ backgroundColor: 'powderblue' }}>
      <form onSubmit={handleMessageSubmit}>
        <section id='messages-list'>
          <ul>
            {chatList &&
              chatList.map((chat, i) => (
                <div key={i}>
                  <img src={chat.photoUrl} />
                  <span>{chat.author}</span>
                  <span>{chat.content}</span>
                  <span>{chat.date}</span>
                </div>
              ))
            }
          </ul>
        </section>
        <section id='new-message'>
          <input
            onChange={handleInputChange}
            type='text'
            name='message'
            value={input}
          />
        </section>
        <input type='submit' value='SEND' />
      </form>
    </div>
  );
}

export default Chat;

Chat.propTypes = {
  user: PropTypes.object,
  socket: PropTypes.object,
  chatList: PropTypes.array,
  addChat: PropTypes.func.isRequired,
};