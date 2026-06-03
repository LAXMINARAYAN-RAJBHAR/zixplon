import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // only use scrollIntoView on video page
    if (location.pathname.startsWith("/video/")) {
      setTimeout(() => {
        const player = document.querySelector(".video_player_wrapper");
        if (player) {
          player.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      // all other pages scroll to top normally
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname, location.key]);

  return null;
};

export default ScrollToTop;