import React from 'react'
import './footer.css'

const Footer = () => {
  return (
    <div className="footer">
      <p>© 2021 - {new Date().getFullYear()} ZIXPLON&reg; All rights reserved.</p>
      <p>Origin: <span className="footer_dev">Made in India</span></p>
      <div className="footer_links">
        <a href="#/about" className="footer_link">About</a>
        <span className="footer_divider">|</span>
        <a href="#/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="footer_link">Terms &amp; Conditions</a>
        <span className="footer_divider">|</span>
        <a href="#/privacy-policy" className="footer_link">Privacy Policy</a>
        <span className="footer_divider">|</span>
        <a href="#/dmca" className="footer_link">DMCA</a>
        <span className="footer_divider">|</span>
        <a href="#/community-guidelines" className="footer_link">Community Guidelines</a>
        <span className="footer_divider">|</span>
        <a href="#/advertise" className="footer_link">Advertise</a>
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