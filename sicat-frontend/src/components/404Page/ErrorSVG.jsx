import { useEffect } from "react";

export default function ErrorSVG() {
    useEffect(() => {
        const body = document.body;
        let starInterval;

        function createStar() {
            var right = Math.random() * 500;
            var top = Math.random() * window.screen.height;
            var star = document.createElement("div");
            star.classList.add("error-star");
            body.appendChild(star);
            star.style.top = top + "px";

            var runInterval = setInterval(function () {
                if (right >= window.screen.width) {
                    star.remove();
                    clearInterval(runInterval);
                }
                right += 3;
                star.style.right = right + "px";
            }, 10);
        }

        starInterval = setInterval(createStar, 100);

        return () => {
            clearInterval(starInterval);
            // Clean up any remaining stars
            document.querySelectorAll(".error-star").forEach((s) => s.remove());
        };
    }, []);

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;700&display=swap');

        .error-wrapper {
          margin: 0;
          padding: 0;
          font-family: 'Tomorrow', sans-serif;
          height: 100vh;
          background-image: linear-gradient(to top, #2e1753, #1f1746, #131537, #0d1028, #050819);
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          position: relative;
        }

        .error-text {
          position: absolute;
          top: 10%;
          color: #fff;
          text-align: center;
        }

        .error-text h1 {
          font-size: 50px;
          margin: 0;
        }

        .error-star {
          position: absolute;
          width: 2px;
          height: 2px;
          background: #fff;
          right: 0;
          animation: starTwinkle 3s infinite linear;
        }

        .error-astronaut img {
          width: 100px;
          position: absolute;
          top: 55%;
          animation: astronautFly 6s infinite linear;
        }

        @keyframes astronautFly {
          0%   { left: -100px; }
          25%  { top: 50%;  transform: rotate(30deg); }
          50%  { transform: rotate(45deg); top: 55%; }
          75%  { top: 60%;  transform: rotate(30deg); }
          100% { left: 110%; transform: rotate(45deg); }
        }

        @keyframes starTwinkle {
          0%   { background: rgba(255,255,255,0.4); }
          25%  { background: rgba(255,255,255,0.8); }
          50%  { background: rgba(255,255,255,1);   }
          75%  { background: rgba(255,255,255,0.8); }
          100% { background: rgba(255,255,255,0.4); }
        }
      `}</style>

            <div className="error-wrapper">
                <div className="error-text">
                    <div>ERROR</div>
                    <h1>404</h1>
                    <hr />
                    <div>Page Not Found</div>
                </div>

                <div className="error-astronaut">
                    <img
                        src="https://images.vexels.com/media/users/3/152639/isolated/preview/506b575739e90613428cdb399175e2c8-space-astronaut-cartoon-by-vexels.png"
                        alt="Floating astronaut"
                    />
                </div>
            </div>
        </>
    );
}