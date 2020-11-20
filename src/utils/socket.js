import io from 'socket.io-client';

const socket = io();

export const getMySocketId = () => socket.id;

const roomSocket = {
  createRoom({ roomData }, cb) {
    socket.emit('create room', { roomData }, cb);
  },
  updateRoomList() {
    socket.emit('update room list');
  },
  joinRoom({ roomId, user }, cb) {
    socket.emit('join room', { roomId, user }, cb);
  },
  leaveRoom({ roomId }) {
    socket.emit('leave room', { roomId });
  },
  updateRoomLockingStatus({ roomId, isLocked }) {
    socket.emit('update room locking status', { roomId, isLocked });
  },
  listenUpdateRoomList(cb) {
    socket.on('update room list', cb);
  },
  listenMemberJoined(cb) {
    socket.on('member joined', cb);
  },
  listenMemberLeaved(cb) {
    socket.on('member leaved', cb);
  },
  listenUpdateRoomLockingStatus(cb) {
    socket.on('update room locking status', cb);
  },
  cleanUpLobbyListener() {
    socket.off('update room list');
  },
  cleanUpRoomListener() {
    socket.off('member joined');
    socket.off('member leaved');
    socket.off('update room locking status');
  },
};

const chatSocket = {
  sendMessage({ newChat }) {
    socket.emit('message', { chat: newChat });
  },
  listenMessage(cb) {
    socket.on('message', cb);
  },
  cleanUpMessageListener() {
    socket.off('message');
  },
};

const peerSocket = {
  sendingSignal({ signal, receiver }) {
    socket.emit('sending signal', { signal, receiver });
  },
  listenSendingSignal(cb) {
    socket.on('sending signal', cb);
  },
  returnSignal({ signal, receiver }) {
    socket.emit('returning signal', { signal, receiver });
  },
  listenReturningSignal(cb) {
    socket.on('returning signal', cb);
  },
  cleanUpPeerListener() {
    socket.off('sending signal');
    socket.off('returning signal');
  },
};

const gameSocket = {
  broadcastSpeechBomb(gameData) {
    socket.emit('game-speechbomb', gameData);
  },
  listenSpeechBomb(cb) {
    socket.on('game-speechbomb', cb);
  },
  cleanUpGameListener() {
    socket.off('game-speechbomb');
  },
};

export { roomSocket, chatSocket, peerSocket, gameSocket };
