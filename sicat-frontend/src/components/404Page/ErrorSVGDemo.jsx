import { Link } from "react-router-dom";
import "./ErrorSVGDemo.css";

const STARS = Array.from({ length: 36 }, (_, index) => {
  const size = 2 + (index % 3);
  const top = ((index * 29 + 11) % 94) + 2;
  const duration = 5.5 + (index % 7) * 0.9;
  const delay = -((index * 1.37) % duration);
  const opacity = (0.45 + (index % 5) * 0.13).toFixed(2);

  return {
    id: index,
    size,
    top,
    duration,
    delay,
    opacity,
  };
});

export default function ErrorSVGDemo() {
  return (
    <div className="error-demo-wrapper">
      <div className="error-demo-hud">
        <span className="error-demo-hud__badge">GPU Demo</span>
        <span>
          0 <code>setInterval</code> · 0 reflows · solo <code>transform: translate3d</code> + <code>opacity</code>
        </span>
        <Link to="/404" className="error-demo-hud__link">
          Comparar con /404 original
        </Link>
      </div>

      <div className="error-demo-stars" aria-hidden="true">
        {STARS.map((star) => (
          <span
            key={star.id}
            className="error-demo-star"
            style={{
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              "--star-opacity": star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="error-demo-text">
        <div className="error-demo-eyebrow">ERROR</div>
        <h1 className="error-demo-title">404</h1>
        <hr className="error-demo-divider" />
        <div className="error-demo-subtitle">Page Not Found</div>
      </div>

      <div className="error-demo-astronaut" aria-hidden="true">
        <img
          src="https://images.vexels.com/media/users/3/152639/isolated/preview/506b575739e90613428cdb399175e2c8-space-astronaut-cartoon-by-vexels.png"
          alt="Astronauta"
        />
      </div>
    </div>
  );
}
