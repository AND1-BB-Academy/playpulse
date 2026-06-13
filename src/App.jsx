import { useEffect, useRef, useState } from 'react'
import Court from './components/Court'
import './App.css'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'


function AdSenseSidebar() {
  useEffect(() => {
    try {
      ; (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.log(e)
    }
  }, [])

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-8489543486493884"
      data-ad-slot="2502605483"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}


function App() {
  const [newPlayer, setNewPlayer] = useState('')
  const [bench, setBench] = useState([])
  const [onCourt, setOnCourt] = useState([])
  const [shots, setShots] = useState([])
  const [events, setEvents] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [subOutPlayer, setSubOutPlayer] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const videoRef = useRef(null)
  const [periodLength, setPeriodLength] = useState(10 * 60)
  const [quarter, setQuarter] = useState(1)
  const [gameSeconds, setGameSeconds] = useState(10 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [playerMinutes, setPlayerMinutes] = useState({})
  const [draggingPlayer, setDraggingPlayer] = useState(null)
  const [teamName, setTeamName] = useState('TEAM')
  const courtRef = useRef(null)
  const [showMenu, setShowMenu] = useState(false)



  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60


    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const formatMinutes = (seconds) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60

    return `${min}:${String(sec).padStart(2, '0')}`
  }

  const getPlayerTotalSeconds = (number) => {
    const data = playerMinutes[number]

    if (!data) return 0

    if (data.currentInAt !== null) {
      return data.totalSeconds + Math.max(0, data.currentInAt - gameSeconds)
    }

    return data.totalSeconds
  }
  const drawShotChartOnPdf = (doc, playerNumber, x, y) => {
    const chartW = 150
    const chartH = 108

    // pdf-court.png内の余白補正
    const courtPadX = -7
    const courtPadY = -1
    const courtScaleX = 1.11
    const courtScaleY = 1.02

    doc.addImage('/pdf-court.png', 'PNG', x, y, chartW, chartH)

    const playerShots = shots.filter(
      (shot) =>
        shot.player === playerNumber &&
        shot.shotType !== 'FT' &&
        shot.result !== 'pending'
    )

    playerShots.forEach((shot) => {
      const px =
        x + (shot.x / 100) * chartW * courtScaleX + courtPadX

      const py =
        y + (shot.y / 72) * chartH * courtScaleY + courtPadY

      if (shot.result === 'make') {
        doc.setDrawColor(7, 26, 58)
        doc.setLineWidth(0.8)
        doc.circle(px, py, 2.5, 'S')
      }

      if (shot.result === 'miss') {
        doc.setDrawColor(201, 145, 45)
        doc.setLineWidth(0.8)

        doc.line(px - 2.5, py - 2.5, px + 2.5, py + 2.5)
        doc.line(px + 2.5, py - 2.5, px - 2.5, py + 2.5)
      }
    })
  }



  useEffect(() => {
    if (!isTimerRunning) return

    const timer = setInterval(() => {
      setGameSeconds((prev) => {
        if (prev <= 0) {
          setIsTimerRunning(false)
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isTimerRunning])




  const addPlayer = () => {
    const number = newPlayer.trim()
    if (!number) return

    if (bench.includes(number) || onCourt.includes(number)) {
      alert('同じ背番号は登録できません')
      return
    }

    setBench([...bench, number])
    setPlayerMinutes((prev) => ({
      ...prev,
      [number]: {
        totalSeconds: 0,
        currentInAt: null,
      },
    }))
    setNewPlayer('')
  }

  const selectOnCourtPlayer = (number) => {
    setSelectedPlayer(number)
    setSubOutPlayer(number)
  }

  const handleBenchClick = (number) => {
    if (subOutPlayer) {
      const outData = playerMinutes[subOutPlayer] || {
        totalSeconds: 0,
        currentInAt: gameSeconds,
      }

      const playedSeconds = Math.max(
        0,
        outData.currentInAt - gameSeconds
      )

      setPlayerMinutes((prev) => ({
        ...prev,
        [subOutPlayer]: {
          totalSeconds: outData.totalSeconds + playedSeconds,
          currentInAt: null,
        },
        [number]: {
          totalSeconds: prev[number]?.totalSeconds || 0,
          currentInAt: gameSeconds,
        },
      }))

      setOnCourt(
        onCourt.map((player) =>
          player === subOutPlayer ? number : player
        )
      )

      setBench([
        ...bench.filter((player) => player !== number),
        subOutPlayer,
      ])

      setSelectedPlayer(number)
      setSubOutPlayer(null)
      return
    }

    if (onCourt.length >= 5) return

    setPlayerMinutes((prev) => ({
      ...prev,
      [number]: {
        totalSeconds: prev[number]?.totalSeconds || 0,
        currentInAt: gameSeconds,
      },
    }))

    setBench(bench.filter((player) => player !== number))
    setOnCourt([...onCourt, number])
    setSelectedPlayer(number)
  }

  const handlePlayerDrop = (benchPlayer) => {
    if (!draggingPlayer) return

    const outData = playerMinutes[draggingPlayer] || {
      totalSeconds: 0,
      currentInAt: gameSeconds,
    }

    const playedSeconds = Math.max(
      0,
      outData.currentInAt - gameSeconds
    )

    setPlayerMinutes((prev) => ({
      ...prev,
      [draggingPlayer]: {
        totalSeconds: outData.totalSeconds + playedSeconds,
        currentInAt: null,
      },
      [benchPlayer]: {
        totalSeconds: prev[benchPlayer]?.totalSeconds || 0,
        currentInAt: gameSeconds,
      },
    }))

    setOnCourt(
      onCourt.map((player) =>
        player === draggingPlayer ? benchPlayer : player
      )
    )

    setBench([
      ...bench.filter((player) => player !== benchPlayer),
      draggingPlayer,
    ])

    setSelectedPlayer(benchPlayer)
    setDraggingPlayer(null)
  }

  const getCubicPoint = (p0, p1, p2, p3, t) => {
    const mt = 1 - t

    return {
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y,
    }
  }

  const judgeShotType = (x, y) => {
    const offsetX = -3.44

    const leftCornerX = 18.35 + offsetX
    const rightCornerX = 87.85 + offsetX

    const leftCornerEndY = 20.8
    const rightCornerEndY = 20.8

    if (x <= leftCornerX && y <= leftCornerEndY) {
      return '3PT'
    }

    if (x >= rightCornerX && y <= rightCornerEndY) {
      return '3PT'
    }

    const curvePoints = []

    const curves = [
      {
        p0: { x: 18.35 + offsetX, y: 20.8 },
        p1: { x: 18.5 + offsetX, y: 26.0 },
        p2: { x: 21.8 + offsetX, y: 34.5 },
        p3: { x: 28.8 + offsetX, y: 41.5 },
      },
      {
        p0: { x: 28.8 + offsetX, y: 41.5 },
        p1: { x: 36.0 + offsetX, y: 48.8 },
        p2: { x: 44.5 + offsetX, y: 52.0 },
        p3: { x: 53.1 + offsetX, y: 52.0 },
      },
      {
        p0: { x: 53.1 + offsetX, y: 52.0 },
        p1: { x: 61.7 + offsetX, y: 52.0 },
        p2: { x: 70.2 + offsetX, y: 48.8 },
        p3: { x: 77.4 + offsetX, y: 41.5 },
      },
      {
        p0: { x: 77.4 + offsetX, y: 41.5 },
        p1: { x: 84.4 + offsetX, y: 34.5 },
        p2: { x: 87.7 + offsetX, y: 26.0 },
        p3: { x: 87.85 + offsetX, y: 20.8 },
      },
    ]

    curves.forEach((curve) => {
      for (let i = 0; i <= 30; i++) {
        const t = i / 30
        curvePoints.push(
          getCubicPoint(curve.p0, curve.p1, curve.p2, curve.p3, t)
        )
      }
    })

    const nearest = curvePoints.reduce((best, point) => {
      const currentDistance = Math.abs(point.x - x)
      const bestDistance = Math.abs(best.x - x)

      return currentDistance < bestDistance ? point : best
    }, curvePoints[0])

    const lineBuffer = 1.8

    if (y > nearest.y + lineBuffer) {
      return '3PT'
    }

    return '2PT'
  }

  const handleVideoDrop = (e) => {
    e.preventDefault()

    const file = e.dataTransfer.files[0]

    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('動画ファイルを選択してください')
      return
    }

    const url = URL.createObjectURL(file)
    setVideoUrl(url)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }


  const handleCourtClick = (e) => {
    if (!selectedPlayer) {
      alert('ON COURTの選手を選択してください')
      return
    }

    const svg = e.currentTarget

    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY

    const svgPoint = point.matrixTransform(
      svg.getScreenCTM().inverse()
    )

    const shotType = judgeShotType(svgPoint.x, svgPoint.y)

    const newShot = {
      id: Date.now(),
      player: selectedPlayer,
      x: svgPoint.x,
      y: svgPoint.y,
      shotType,
      result: 'pending',
      quarter,
      clock: formatTime(gameSeconds),
    }

    setShots([...shots, newShot])
  }

  const addFreeThrow = () => {
    if (!selectedPlayer) {
      alert('ON COURTの選手を選択してください')
      return
    }

    const newShot = {
      id: Date.now(),
      player: selectedPlayer,
      x: null,
      y: null,
      shotType: 'FT',
      result: 'pending',
    }

    setShots([...shots, newShot])
  }

  const addGameEvent = (eventType) => {
    if (!selectedPlayer) {
      alert('ON COURTの選手を選択してください')
      return
    }

    const newEvent = {
      id: Date.now(),
      player: selectedPlayer,
      eventType,
      quarter,
      clock: formatTime(gameSeconds),
      quarter,
    }

    setEvents((prev) => [...prev, newEvent])
  }

  const updateLastShot = (result) => {
    setShots((prevShots) => {
      if (prevShots.length === 0) return prevShots

      const lastIndex = prevShots.length - 1

      return prevShots.map((shot, index) =>
        index === lastIndex ? { ...shot, result } : shot
      )
    })
  }

  const undoLastAction = () => {
    const lastShot = shots[shots.length - 1]
    const lastEvent = events[events.length - 1]

    if (!lastShot && !lastEvent) return

    if (!lastEvent || (lastShot && lastShot.id > lastEvent.id)) {
      setShots((prevShots) => prevShots.slice(0, -1))
      return
    }

    setEvents((prevEvents) => prevEvents.slice(0, -1))
  }

  const calculateSelectedStats = () => {
    if (!selectedPlayer) {
      return null
    }

    const playerShots = shots.filter(
      (shot) =>
        shot.player === selectedPlayer &&
        shot.result !== 'pending'
    )

    const fgShots = playerShots.filter(
      (shot) => shot.shotType !== 'FT'
    )

    const twoPtShots = playerShots.filter(
      (shot) => shot.shotType === '2PT'
    )

    const threePtShots = playerShots.filter(
      (shot) => shot.shotType === '3PT'
    )

    const ftShots = playerShots.filter(
      (shot) => shot.shotType === 'FT'
    )

    const made = (list) =>
      list.filter((shot) => shot.result === 'make').length

    const percent = (m, a) => {
      if (a === 0) return '-'
      return `${Math.round((m / a) * 100)}%`
    }

    const fgM = made(fgShots)
    const fgA = fgShots.length

    const twoM = made(twoPtShots)
    const twoA = twoPtShots.length

    const threeM = made(threePtShots)
    const threeA = threePtShots.length

    const ftM = made(ftShots)
    const ftA = ftShots.length

    const points = twoM * 2 + threeM * 3 + ftM

    return {
      minutes: formatMinutes(
        getPlayerTotalSeconds(selectedPlayer)
      ),
      points,
      fgM,
      fgA,
      fgPercent: percent(fgM, fgA),
      twoM,
      twoA,
      twoPercent: percent(twoM, twoA),
      threeM,
      threeA,
      threePercent: percent(threeM, threeA),
      ftM,
      ftA,
      ftPercent: percent(ftM, ftA),
    }
  }
  const exportPdf = () => {
    console.log('PDF button clicked')

    const pdf = new jsPDF('l', 'mm', 'a4')

    pdf.setFontSize(18)
    pdf.text('PlayPulse Game Report', 14, 18)
    drawTextAsImage(pdf, teamName, 14, 21, 8
    )


    let y = 40

    const players = [...onCourt, ...bench]

    const percent = (madeCount, attemptCount) => {
      if (attemptCount === 0) return '-'
      return `${Math.round((madeCount / attemptCount) * 100)}%`
    }

    const playerRows = [...players]
      .sort((a, b) => Number(a) - Number(b))
      .map((player) => {
        const playerShots = shots.filter(
          (shot) =>
            shot.player === player &&
            shot.result !== 'pending'
        )

        const fgShots = playerShots.filter(
          (shot) => shot.shotType !== 'FT'
        )

        const threePtShots = playerShots.filter(
          (shot) => shot.shotType === '3PT'
        )

        const ftShots = playerShots.filter(
          (shot) => shot.shotType === 'FT'
        )

        const made = (list) =>
          list.filter((shot) => shot.result === 'make').length

        const fgM = made(fgShots)
        const threeM = made(threePtShots)
        const ftM = made(ftShots)

        const points =
          playerShots.filter(
            (shot) => shot.shotType === '2PT' && shot.result === 'make'
          ).length * 2 +
          threeM * 3 +
          ftM

        const playerEvents = events.filter(
          (event) => event.player === player
        )

        const countEvent = (eventType) =>
          playerEvents.filter(
            (event) => event.eventType === eventType
          ).length

        const orb = countEvent('ORB')
        const drb = countEvent('DRB')
        const reb = orb + drb

        return [
          `#${player}`,
          formatMinutes(getPlayerTotalSeconds(player)),
          points,
          `${fgM}/${fgShots.length}`,
          percent(fgM, fgShots.length),
          `${threeM}/${threePtShots.length}`,
          percent(threeM, threePtShots.length),
          `${ftM}/${ftShots.length}`,
          percent(ftM, ftShots.length),
          orb,
          drb,
          reb,
          countEvent('AST'),
          countEvent('STL'),
          countEvent('BLK'),
          countEvent('TOV'),
          countEvent('PF'),
        ]
      })

    pdf.setFontSize(14)
    pdf.setTextColor(7, 26, 58)
    pdf.text('Player Stats', 14, y)

    autoTable(pdf, {
      startY: y + 6,
      head: [[
        'Player', 'MIN', 'PTS', 'FG', 'FG%', '3PT', '3PT%', 'FT', 'FT%',
        'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'
      ]],
      body: playerRows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [7, 26, 58],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [70, 70, 70],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    })

    y = pdf.lastAutoTable.finalY + 18

    const totalFgM = shots.filter(
      (s) => s.result === 'make' && s.shotType !== 'FT'
    ).length

    const totalFgA = shots.filter(
      (s) => s.result !== 'pending' && s.shotType !== 'FT'
    ).length

    const totalTwoM = shots.filter(
      (s) => s.result === 'make' && s.shotType === '2PT'
    ).length

    const totalTwoA = shots.filter(
      (s) => s.result !== 'pending' && s.shotType === '2PT'
    ).length

    const totalThreeM = shots.filter(
      (s) => s.result === 'make' && s.shotType === '3PT'
    ).length

    const totalThreeA = shots.filter(
      (s) => s.result !== 'pending' && s.shotType === '3PT'
    ).length

    const totalFtM = shots.filter(
      (s) => s.result === 'make' && s.shotType === 'FT'
    ).length

    const totalFtA = shots.filter(
      (s) => s.result !== 'pending' && s.shotType === 'FT'
    ).length

    const countTeamEvent = (eventType) =>
      events.filter((event) => event.eventType === eventType).length

    const totalOrb = countTeamEvent('ORB')
    const totalDrb = countTeamEvent('DRB')
    const totalAst = countTeamEvent('AST')
    const totalStl = countTeamEvent('STL')
    const totalBlk = countTeamEvent('BLK')
    const totalTov = countTeamEvent('TOV')
    const totalPf = countTeamEvent('PF')

    const rate = (madeCount, attemptCount) => {
      if (attemptCount === 0) return '-'
      return `${Math.round((madeCount / attemptCount) * 100)}%`
    }

    y = pdf.lastAutoTable.finalY + 12

    pdf.setFontSize(14)
    pdf.setTextColor(7, 26, 58)
    pdf.text('Team Total', 14, y)

    autoTable(pdf, {
      startY: y + 6,
      head: [[
        'PTS', 'FG', 'FG%', '2PT', '2PT%', '3PT', '3PT%', 'FT', 'FT%',
        'ORB', 'DRB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'
      ]],
      body: [[
        totalTwoM * 2 + totalThreeM * 3 + totalFtM,
        `${totalFgM}/${totalFgA}`,
        rate(totalFgM, totalFgA),
        `${totalTwoM}/${totalTwoA}`,
        rate(totalTwoM, totalTwoA),
        `${totalThreeM}/${totalThreeA}`,
        rate(totalThreeM, totalThreeA),
        `${totalFtM}/${totalFtA}`,
        rate(totalFtM, totalFtA),
        totalOrb,
        totalDrb,
        totalOrb + totalDrb,
        totalAst,
        totalStl,
        totalBlk,
        totalTov,
        totalPf,
      ]],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [7, 26, 58],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [70, 70, 70],
      },
    })

    y = pdf.lastAutoTable.finalY + 12

    const playersWithShots = players
      .filter((player) =>
        shots.some(
          (shot) =>
            shot.player === player &&
            shot.shotType !== 'FT' &&
            shot.result !== 'pending'
        )
      )
      .sort((a, b) => Number(a) - Number(b))


    let currentY = y + 20

    if (playersWithShots.length > 0) {
      pdf.addPage()
    }

    playersWithShots.forEach((player, index) => {
      if (index > 0) {
        pdf.addPage()
      }

      const chartX = 14
      const chartY = 30

      pdf.setTextColor(7, 26, 58)
      pdf.setFontSize(12)
      pdf.text(`#${player} Shot Chart`, chartX, chartY - 8)

      drawShotChartOnPdf(pdf, player, chartX, chartY)
    })


    pdf.save('playpulse-report.pdf')
  }

  const drawTextAsImage = (pdf, text, x, y, fontSize = 18) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    ctx.font = `bold ${fontSize * 4}px sans-serif`

    const textWidth = ctx.measureText(text).width

    canvas.width = textWidth + 40
    canvas.height = fontSize * 5

    ctx.font = `bold ${fontSize * 4}px sans-serif`
    ctx.fillStyle = '#071a3a'
    ctx.textBaseline = 'top'
    ctx.fillText(text, 20, 10)

    const imgData = canvas.toDataURL('image/png')

    pdf.addImage(
      imgData,
      'PNG',
      x,
      y,
      canvas.width / 4,
      canvas.height / 4
    )
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement

      if (
        activeElement &&
        (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA'
        )
      ) {
        return
      }

      const video = videoRef.current

      if (e.code === 'Space') {
        e.preventDefault()
        setIsTimerRunning((prev) => !prev)
        return
      }

      if (e.key === 'q' || e.key === 'Q') {
        setQuarter((prev) => {
          const next = prev + 1

          if (next <= 4) {
            setGameSeconds(periodLength)
          } else {
            setGameSeconds(5 * 60)
          }

          return next
        })

        setIsTimerRunning(false)
        return
      }

      if (video) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 5)
          return
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 5)
          return
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 1)
          return
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 1)
          return
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        addGameEvent('ORB')
        return
      }

      if (e.key === 'd' || e.key === 'D') {
        addGameEvent('DRB')
        return
      }

      if (e.key === 'o' || e.key === 'O') {
        updateLastShot('make')
        return
      }

      if (e.key === 'x' || e.key === 'X') {
        updateLastShot('miss')
        return
      }

      if (e.key === 'u' || e.key === 'U') {
        if (e.key === 'u' || e.key === 'U') {
          undoLastAction()
          return
        }
        return
      }

      if (e.key === 'f' || e.key === 'F') {
        addFreeThrow()
        return
      }

      if (e.key === 'a' || e.key === 'A') {
        addGameEvent('AST')
        return
      }

      if (e.key === 't' || e.key === 'T') {
        addGameEvent('TOV')
        return
      }

      if (e.key === 's' || e.key === 'S') {
        addGameEvent('STL')
        return
      }

      if (e.key === 'b' || e.key === 'B') {
        addGameEvent('BLK')
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        addGameEvent('PF')
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [shots, selectedPlayer, events])

  const newestLogs = [
    ...shots.map((shot) => ({
      id: shot.id,
      player: shot.player,
      text: `${shot.shotType} ${shot.result === 'make'
        ? 'MADE'
        : shot.result === 'miss'
          ? 'MISS'
          : 'PENDING'
        }`,
      clock: shot.clock,
    })),

    ...events.map((event) => ({
      id: event.id,
      player: event.player,
      text: event.eventType,
      clock: event.clock,
    })),
  ].sort((a, b) => b.id - a.id)

  const visibleShots = selectedPlayer
    ? shots.filter(
      (shot) =>
        shot.player === selectedPlayer &&
        shot.shotType !== 'FT'
    )
    : shots.filter((shot) => shot.shotType !== 'FT')

  const selectedStats = calculateSelectedStats()

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand-area">
          <img
            src="/playpulse-logo.png"
            alt="PlayPulse"
            className="header-logo"
          />
        </div>

        <div className="clock-area">
          <div className="game-clock">
            <img
              src="/clock-frame.png"
              alt=""
              className="clock-frame-img"
            />

            <div className="quarter">
              {quarter <= 4 ? `Q${quarter}` : `OT${quarter - 4}`}
            </div>

            <div className="clock">
              {formatTime(gameSeconds)}
            </div>
          </div>


        </div>

        <div className="header-right">
          <div className="plan-badge">FREE</div>

          <button
            className="menu-button"
            onClick={() => setShowMenu(!showMenu)}
          >
            ☰
          </button>

          {showMenu && (
            <div className="menu-dropdown">
              <a href="/terms.html">利用規約</a>
              <a href="/privacy.html">プライバシーポリシー</a>
              <a href="/contact.html">お問い合わせ</a>
            </div>
          )}
        </div>
      </header>

      <main className="three-column-layout">
        <aside className="left-ad-panel">
          <div className="ad-box">
            <AdSenseSidebar />

            <div className="ad-text">
              Upgrade to PlayPulse Pro
            </div>
          </div>
        </aside>

        <section className="media-panel">
          <div
            className="video-panel"
            onDrop={handleVideoDrop}
            onDragOver={handleDragOver}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="video-player"
              />
            ) : (
              <div className="drop-message">
                MP4動画をドラッグ&ドロップ
              </div>
            )}
          </div>

          <div className="inline-log-panel">
            <div className="log-box">
              <div className="panel-title">EVENT LOG</div>

              <div className="event-list">
                {newestLogs.map((log) => (
                  <div key={log.id} className="event-item">
                    <span className="event-time">
                      {log.clock || '--:--'}
                    </span>

                    <span className="event-player">
                      #{log.player}
                    </span>

                    <span className="event-text">
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedStats && (
              <div className="inline-stats-box">
                <div className="panel-title">
                  SELECTED #{selectedPlayer}
                </div>

                <div className="inline-points">
                  {selectedStats.points}
                  <span>PTS</span>
                </div>

                <div className="inline-stats-grid">
                  <div>
                    MIN
                    <strong>{selectedStats.minutes}</strong>
                  </div>

                  <div>
                    FG
                    <strong>
                      {selectedStats.fgM}/{selectedStats.fgA}
                    </strong>
                  </div>

                  <div>
                    3PT
                    <strong>
                      {selectedStats.threeM}/{selectedStats.threeA}
                    </strong>
                  </div>

                  <div>
                    FT
                    <strong>
                      {selectedStats.ftM}/{selectedStats.ftA}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="side-panel">
          <div className="team-name-card">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="team-name-input"
            />
          </div>

          <div className="chart-card chart-only">
            <div ref={courtRef}>
              <Court
                shots={visibleShots}
                onCourtClick={handleCourtClick}
              />
            </div>
          </div>

          <div className="roster-card">
            <h2>ROSTER</h2>


            <div className="roster-section">
              <h3>ON COURT ({onCourt.length}/5)</h3>

              <div className="player-list">
                {onCourt.map((number) => (
                  <button
                    key={number}
                    className={
                      subOutPlayer === number
                        ? 'player-chip sub-out'
                        : selectedPlayer === number
                          ? 'player-chip selected'
                          : 'player-chip active'
                    }
                    onClick={() => selectOnCourtPlayer(number)}
                    draggable
                    onDragStart={() => setDraggingPlayer(number)}
                    onDragEnd={() => setDraggingPlayer(null)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>

            <div className="roster-section">
              <h3>
                BENCH
                {subOutPlayer && (
                  <span className="sub-hint">
                    {' '}→ SELECT IN PLAYER
                  </span>
                )}
              </h3>

              <div className="player-list bench-list">
                {bench.map((number) => (
                  <button
                    key={number}
                    className="player-chip"
                    onClick={() => handleBenchClick(number)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handlePlayerDrop(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>

            <div className="player-form">
              <input
                type="number"
                placeholder="#"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
              />

              <button onClick={addPlayer}>+</button>

              <button
                className="delete-btn"
                onClick={() => {
                  const player = newPlayer.trim()

                  if (!player) return

                  if (onCourt.includes(player)) {
                    alert('ON COURTの選手は削除できません')
                    return
                  }

                  setBench((prev) =>
                    prev.filter((p) => p !== player)
                  )

                  if (selectedPlayer === player) {
                    setSelectedPlayer(null)
                  }

                  setNewPlayer('')
                }}
              >
                −
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="menu-bar">
        <button
          className="pdf-button"
          onClick={exportPdf}
        >
          PDF出力
        </button>

        <select
          className="period-select"
          value={periodLength}
          onChange={(e) => {
            const nextLength = Number(e.target.value)
            setPeriodLength(nextLength)

            if (quarter <= 4) {
              setGameSeconds(nextLength)
              setIsTimerRunning(false)
            }
          }}
        >
          <option value={6 * 60}>6:00</option>
          <option value={8 * 60}>8:00</option>
          <option value={10 * 60}>10:00</option>
          <option value={12 * 60}>12:00</option>
        </select>


        <span>
          Space Clock / O Make / X Miss / U Undo / F FT / R ORB / D DRB / A AST / T TOV / S STL / B BLK / P PF
        </span>
      </footer>

    </div>
  )
}

export default App