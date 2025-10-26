import React from 'react';

function Footer() {
  return (
    <footer style={{ backgroundColor: '#000', color: '#fff', padding: '2vh 4vw', textAlign: 'center', marginTop: 'auto' }}>
      <img
        src="/ONGCFOOTERLOGO.png"
        alt="ONGC Logo"
        style={{ width: '6vw', height: '9vh', position: 'relative', right: '46.5%', marginBottom: '2vh' }}
      />
      <hr style={{ color: 'white' }} />
      <div className="bottom" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p>© 2024 The Oil and Natural Gas Corporation. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
