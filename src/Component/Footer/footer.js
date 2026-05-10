import React from 'react'
import './footer.css'

const Footer = () => {
  return (
    <div className="footer">
      <p>© {new Date().getFullYear()} VidOmni. All rights reserved.</p>
      <p>Developed by <span className="footer_dev">Laxminarayan Rajbhar</span></p>
    </div>
  )
}

export default Footer