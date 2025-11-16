import React from 'react';

const Modal = ({ showModal, handleClose, modalContent, title, showCloseButton = true }) => {
  const modalStyle = {
    display: showModal ? 'block' : 'none',
    position: 'fixed',
    zIndex: 1,
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    overflow: 'auto',
    backgroundColor: 'rgba(0,0,0,0.4)',
  };

  const modalContentStyle = {
    backgroundColor: '#fefefe',
    margin: '15% auto',
    padding: '20px',
    border: 'none',
    width: '80%',
    maxWidth: '500px',
    borderRadius: '12px',
    position: 'relative',
  };

  const closeButtonStyle = {
    color: '#aaa',
    float: 'right',
    fontSize: '28px',
    fontWeight: 'bold',
    cursor: 'pointer',
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        {showCloseButton && (
          <span 
            style={closeButtonStyle} 
            onClick={handleClose}
          >
            &times;
          </span>
        )}
        <div style={{ marginTop: showCloseButton ? '20px' : '0' }}>
          {modalContent}
        </div>
      </div>
    </div>
  );
};

export default Modal;
