function Court({ shots, onCourtClick }) {
  return (
    <div className="court-shell">
      <svg
        onClick={onCourtClick}
        className="court-svg"
        viewBox="0 0 100 72"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id="courtGrid"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 4 0 L 0 0 0 4"
              fill="none"
              stroke="rgba(7, 26, 58, 0.08)"
              strokeWidth="0.22"
            />
          </pattern>
        </defs>

        <g transform="translate(-3.44 0)">
          <rect
            x="10.31"
            y="4.26"
            width="86.25"
            height="64.25"
            rx="1.2"
            fill="#ffffff"
            stroke="rgba(7, 26, 58, 0.82)"
            strokeWidth="0.48"
          />

          <rect
            x="10.31"
            y="4.26"
            width="86.25"
            height="64.25"
            rx="1.2"
            fill="url(#courtGrid)"
            opacity="0.9"
          />

          <path
            d="M 40.02 4.15 L 65.85 4.26 L 65.85 35.5 L 40.13 35.5 Z"
            fill="none"
            stroke="rgba(7, 26, 58, 0.86)"
            strokeWidth="0.55"
          />

          <circle
            cx="53.1"
            cy="10.36"
            r="1"
            fill="#071a3a"
          />

          <path
            d="M 47.23 12.68 Q 52.99 19.77 58.98 13.02"
            fill="none"
            stroke="rgba(7, 26, 58, 0.82)"
            strokeWidth="0.55"
          />

          <path
            d="M 43 35.5 Q 52.88 49 62.76 35.5"
            fill="none"
            stroke="rgba(7, 26, 58, 0.86)"
            strokeWidth="0.55"
          />

          <path
            d="
              M 18.35 4.38
              L 18.35 20.8

              C 18.5 26.0, 21.8 34.5, 28.8 41.5
              C 36.0 48.8, 44.5 52.0, 53.1 52.0
              C 61.7 52.0, 70.2 48.8, 77.4 41.5
              C 84.4 34.5, 87.7 26.0, 87.85 20.8
              L 87.85 4.38
            "
            fill="none"
            stroke="rgba(7, 26, 58, 0.88)"
            strokeWidth="0.65"
          />
        </g>

        {shots.map((shot) => {
          if (shot.result === 'miss') {
            return (
              <g key={shot.id} className="shot-miss">
                <line
                  x1={shot.x - 1.4}
                  y1={shot.y - 1.4}
                  x2={shot.x + 1.4}
                  y2={shot.y + 1.4}
                />
                <line
                  x1={shot.x + 1.4}
                  y1={shot.y - 1.4}
                  x2={shot.x - 1.4}
                  y2={shot.y + 1.4}
                />
              </g>
            )
          }

          return (
            <circle
              key={shot.id}
              cx={shot.x}
              cy={shot.y}
              r="1.7"
              className={
                shot.result === 'make'
                  ? 'shot-made'
                  : 'shot-pending'
              }
            />
          )
        })}
      </svg>
    </div>
  )
}

export default Court