import React from 'react'
import './footer.css'

const Footer = () => {
  return (
    <div className="footer">
      <p>© 2021 - {new Date().getFullYear()} ZIXPLON&reg; All rights reserved.</p>
      <p>Origin: <span className="footer_dev">Made In India</span></p>
      <div className="footer_links">
        <a href="#/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="footer_link">Terms &amp; Conditions</a>
        <span className="footer_divider">|</span>
        <a href="#/feedback" className="footer_link">Feedback</a>
        <span className="footer_divider">|</span>
        <a href="#/help" className="footer_link">Help &amp; FAQ</a>
        <span className="footer_divider">|</span>
        <a href="#/contact" className="footer_link">Contact Support</a>
        <span className="footer_divider">|</span>
        <a href="#/report" className="footer_link">Report a Problem</a>
      </div>
    </div>
  )
}

export default Footer