import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    // Try all possible scrollable containers
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Target the App container specifically for mobile
    const app = document.querySelector(".App");
    if (app) app.scrollTop = 0;
    
    const homePage = document.querySelector(".homePage");
    if (homePage) homePage.scrollTop = 0;

  }, [pathname]);
  
  return null;
};

export default ScrollToTop;