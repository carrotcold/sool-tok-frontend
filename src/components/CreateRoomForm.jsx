import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Button from './Button';

function CreateRoomForm({ onSubmit }) {
  const [inputs, setInputs] = useState({
    roomName: '',
    maxNum: '',
  });

  const submitRoomData = ev => {
    ev.preventDefault();
    onSubmit(inputs);
  };

  const handleInputChange = ev => {
    const { name, value } = ev.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={{ backgroundColor: 'white' }}>
      <h2>Title : 어서 자리 잡자!</h2>
      <h3>Description : 좌석의 최대 인원은 6명입니다.</h3>
      <form onSubmit={submitRoomData}>
        <input
          type='text'
          name='roomName'
          value={inputs.roomName}
          onChange={handleInputChange}
          required
        />
        <input
          type='number'
          name='maxNum'
          min='2'
          max='6'
          placeholder='2'
          value={inputs.maxNum}
          onChange={handleInputChange}
          required
        />
        <Button onClick={submitRoomData} text='좌석 잡기' />
      </form>
    </div>
  );
}

export default CreateRoomForm;

CreateRoomForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};
