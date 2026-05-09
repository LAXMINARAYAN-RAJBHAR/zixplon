import React, { useState, useRef, useEffect } from "react";
import "./navbar.css";
import ListIcon from "@mui/icons-material/List";
import MyLogo from "../../assests/mylogo.png";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardVoiceIcon from "@mui/icons-material/KeyboardVoice";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFront";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Link, useNavigate } from "react-router-dom";
import Login from "../Login/login";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import YouTubeIcon from "@mui/icons-material/YouTube";

// ✅ Outside component — pure functions only (no hooks)
const getSuggestions = (q) => {
  if (!q.trim()) return [];
  const base = [
    `${q} 2025`, `${q} trending`, `${q} viral`,
    `${q} new`, `${q} best`, `${q} highlights`,
    `${q} funny`, `${q} latest`,
  ];
  return base.slice(0, 6);
};

const getNotifStyle = (type) => {
  switch (type) {
    case "upload":     return { color: "#ff4444", icon: "🎬" };
    case "like":       return { color: "#ff9800", icon: "❤️" };
    case "comment":    return { color: "#2196f3", icon: "💬" };
    case "subscriber": return { color: "#4caf50", icon: "🔔" };
    default:           return { color: "#aaa",    icon: "📢" };
  }
};

// ✅ Component starts here
const Navbar = ({ setSideNavbarFunc, sideNavbar }) => {
  const navigate = useNavigate();

  // — existing state —
  const [userPic] = useState(
    "https://athenabpo.com/wp-content/uploads/2016/09/Headshot-Blank-Person-Circle-300x300.gif"
  );
  const [navbarModal, setNavbarModal]     = useState(false);
  const [login, setLogin]                 = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [suggestions, setSuggestions]     = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [activeIndex, setActiveIndex]     = useState(-1);
  const [isListening, setIsListening]     = useState(false);

  // — notification state (moved inside) —
  const [notifications, setNotifications] = useState([
    { id: 1, type: "upload",     message: "TechWorld uploaded: 'React 19 Features'",    time: "2m ago",  read: false, avatar: "T" },
    { id: 2, type: "like",       message: "Alex liked your video 'My Portfolio Tour'",  time: "10m ago", read: false, avatar: "A" },
    { id: 3, type: "comment",    message: "Sara commented: 'Great content! 🔥'",        time: "25m ago", read: false, avatar: "S" },
    { id: 4, type: "subscriber", message: "John subscribed to your channel",            time: "1h ago",  read: false, avatar: "J" },
    { id: 5, type: "upload",     message: "CodeWithMe uploaded: 'Node.js Crash Course'",time: "2h ago",  read: true,  avatar: "C" },
    { id: 6, type: "like",       message: "Priya liked your video 'CSS Animations'",    time: "3h ago",  read: true,  avatar: "P" },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  // — refs —
  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);
  const recognitionRef = useRef(null);

  // — derived —
  const unreadCount = notifications.filter((n) => !n.read).length;

  // — notification helpers —
  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markOneRead = (id) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  // — close search dropdown on outside click —
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // — close notif dropdown on outside click —
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // — existing handlers —
  const sideNavbarFunc = () => setSideNavbarFunc(!sideNavbar);

  const handleprofile = () => {
    navigate("/user/7697");
    setNavbarModal(false);
  };

  const setLoginModal = () => setLogin(false);

  const onclickOfPopUpOption = (button) => {
    setNavbarModal(false);
    if (button === "login") setLogin(true);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setActiveIndex(-1);
    if (val.trim()) {
      setSuggestions(getSuggestions(val));
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const doSearch = (q) => {
    if (!q.trim()) return;
    setShowDropdown(false);
    setSearchQuery(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === "Enter") doSearch(searchQuery);
      return;
    }
    if (e.key === "ArrowDown") {
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      activeIndex >= 0 ? doSearch(suggestions[activeIndex]) : doSearch(searchQuery);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const speak = (text, callback) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    utter.rate = 1.1;
    utter.onend = callback;
    window.speechSynthesis.speak(utter);
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice search not supported. Try Chrome."); return; }

    setIsListening(true);
    let gotResult = false;

    speak("Please speak now", () => {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        gotResult = true;
        const transcript = event.results[0][0].transcript;
        recognition.stop();
        setIsListening(false);
        doSearch(transcript);
      };

      recognition.onerror = (e) => {
        if (e.error === "not-allowed") {
          setIsListening(false);
          alert("Mic blocked. Allow mic in Chrome settings.");
        }
      };

      recognition.onend = () => {
        if (!gotResult) { try { recognition.start(); } catch (e) {} }
      };

      recognition.start();
    });
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <div className="navbar">
      {/* LEFT */}
      <div className="navbar-left">
        <div className="navbarHamberger" onClick={sideNavbarFunc}>
          <ListIcon sx={{ color: "white" }} />
        </div>
        <Link to="/" className="navbar-logo-link">
          <img src={MyLogo} alt="App Logo" className="mylogo" />
          <span
            className="logoText"
            onClick={() => {
              const base = window.location.origin + window.location.pathname + "#/";
              if (window.location.href === base) window.location.reload();
              else window.location.href = base;
            }}
          >
            {"RollamRoll".split("").map((char, i) => (
              <span key={i} className="logoChar" style={{ animationDelay: `${i * 0.1}s` }}>
                {char}
              </span>
            ))}
          </span>
        </Link>
      </div>

      {/* MIDDLE */}
      <div className="navbar-middle" ref={dropdownRef} style={{ position: "relative" }}>
        <div className="navbar_searchBox">
          <input
            type="text"
            placeholder="Search"
            className="navbar_searchBoxInput"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
            autoComplete="off"
          />
          <div className="navbar_searchIconBox" onClick={() => doSearch(searchQuery)}>
            <SearchIcon sx={{ fontSize: "28px" }} />
          </div>
        </div>

        <div className="navbar_mike" onClick={startVoiceSearch} title="Voice Search" style={{ cursor: "pointer" }}>
          <KeyboardVoiceIcon sx={{ color: isListening ? "red" : "white", transition: "color 0.2s" }} />
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "48px", left: 0,
            width: "calc(100% - 52px)", background: "#212121",
            borderRadius: "0 0 12px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            zIndex: 9999, overflow: "hidden", border: "1px solid #333", borderTop: "none",
          }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => doSearch(s)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 16px", cursor: "pointer",
                  background: activeIndex === i ? "#303030" : "transparent",
                  transition: "background 0.15s", color: "white", fontSize: "14px",
                }}
              >
                <SearchIcon sx={{ fontSize: "18px", color: "#aaa" }} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className="navbar-right">
        <span onClick={() => navigate("/youtube", { state: { reload: Date.now() } })} style={{ cursor: "pointer" }}>
          <YouTubeIcon sx={{ fontSize: "30px", color: "red" }} />
        </span>
        <span onClick={() => navigate("/reels")} style={{ cursor: "pointer" }}>
          <VideoLibraryIcon sx={{ fontSize: "30px", color: "white" }} />
        </span>
        <span onClick={() => navigate("/763/upload")} style={{ cursor: "pointer" }}>
          <VideoCameraFrontIcon sx={{ fontSize: "30px", color: "white" }} />
        </span>

        {/* NOTIFICATIONS */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <div
            onClick={() => setShowNotifications((prev) => !prev)}
            style={{ position: "relative", cursor: "pointer", display: "flex" }}
          >
            <NotificationsActiveIcon
              sx={{
                fontSize: "30px",
                color: showNotifications ? "#ff4444" : "white",
                transition: "color 0.2s",
                animation: unreadCount > 0 ? "bellShake 1.5s infinite" : "none",
              }}
            />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: "-4px", right: "-4px",
                background: "red", color: "white", borderRadius: "50%",
                fontSize: "10px", fontWeight: "700", width: "18px", height: "18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #0f0f0f", animation: "badgePop 0.3s ease",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>

          {showNotifications && (
            <div style={{
              position: "absolute", top: "42px", right: "-10px", width: "360px",
              background: "#212121", borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)", zIndex: 99999,
              border: "1px solid #333", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", borderBottom: "1px solid #333",
              }}>
                <span style={{ color: "white", fontWeight: "600", fontSize: "16px" }}>Notifications</span>
                {unreadCount > 0 && (
                  <span onClick={markAllRead} style={{ color: "#3ea6ff", fontSize: "13px", cursor: "pointer", fontWeight: "500" }}>
                    Mark all as read
                  </span>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {notifications.map((n) => {
                  const { color, icon } = getNotifStyle(n.type);
                  return (
                    <div
                      key={n.id}
                      onClick={() => markOneRead(n.id)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: "12px",
                        padding: "12px 16px",
                        background: n.read ? "transparent" : "rgba(255,255,255,0.05)",
                        borderBottom: "1px solid #2a2a2a", cursor: "pointer", transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(255,255,255,0.05)")}
                    >
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%", background: color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: "700", fontSize: "15px", color: "white", flexShrink: 0,
                      }}>
                        {n.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, color: n.read ? "#aaa" : "white", fontSize: "13px", lineHeight: "1.4" }}>
                          <span style={{ marginRight: "5px" }}>{icon}</span>
                          {n.message}
                        </p>
                        <span style={{ color: "#666", fontSize: "11px" }}>{n.time}</span>
                      </div>
                      {!n.read && (
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3ea6ff", flexShrink: 0, marginTop: "4px" }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px", textAlign: "center", borderTop: "1px solid #333" }}>
                <span
                  style={{ color: "#3ea6ff", fontSize: "13px", cursor: "pointer" }}
                  onClick={() => navigate("/notifications")}
                >
                  See all notifications
                </span>
              </div>
            </div>
          )}
        </div>

        <img
          onClick={() => setNavbarModal((prev) => !prev)}
          src={userPic} alt="User" className="navbar-right-logo"
        />
        {navbarModal && (
          <div className="navbar-modal">
            <div className="navbar-modal-option" onClick={handleprofile}>Profile</div>
            <div className="navbar-modal-option" onClick={() => onclickOfPopUpOption("logout")}>Logout</div>
            <div className="navbar-modal-option" onClick={() => onclickOfPopUpOption("login")}>Login</div>
          </div>
        )}
      </div>

      {login && <Login setLoginModal={setLoginModal} />}

      {/* Voice Search Modal */}
      {isListening && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "20px",
        }}>
          <div style={{
            background: "#212121", borderRadius: "16px", padding: "40px 60px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%", background: "red",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulse 1.2s infinite",
            }}>
              <KeyboardVoiceIcon sx={{ fontSize: "40px", color: "white" }} />
            </div>
            <p style={{ color: "white", fontSize: "20px", fontWeight: "600" }}>Listening...</p>
            <p style={{ color: "#aaa", fontSize: "14px" }}>Speak now to search</p>
            <button onClick={stopVoiceSearch} style={{
              marginTop: "10px", padding: "8px 24px", borderRadius: "8px",
              border: "1px solid #555", background: "transparent", color: "white",
              cursor: "pointer", fontSize: "14px",
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;