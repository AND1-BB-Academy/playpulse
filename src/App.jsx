import { useEffect, useRef, useState } from 'react'
import { useUserPlan } from './hooks/useUserPlan'
import Court from './components/Court'
import './App.css'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'


import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import {
  doc as firestoreDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

const GAME_STORAGE_KEY = 'playpulse-pro-game-data-v1'

const createInitialTeamState = (teamName) => ({
  teamName,
  newPlayer: '',
  bench: [],
  onCourt: [],
  shots: [],
  events: [],
  selectedPlayer: null,
  subOutPlayer: null,
  playerMinutes: {},
  draggingPlayer: null,
})


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
  const { user: planUser, isPro: firestoreIsPro, loading: planLoading } = useUserPlan()

  const [authUser, setAuthUser] = useState(null)
  const [userPlan, setUserPlan] = useState('free')
  const [authLoading, setAuthLoading] = useState(true)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [showAuthPanel, setShowAuthPanel] = useState(false)

  const isPro = firestoreIsPro

  const [activeTeamKey, setActiveTeamKey] = useState('teamA')
  const [teams, setTeams] = useState({
    teamA: createInitialTeamState('HOME'),
    teamB: createInitialTeamState('AWAY'),
  })

  const [videoUrl, setVideoUrl] = useState(null)
  const videoRef = useRef(null)
  const importGameInputRef = useRef(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraDevices, setCameraDevices] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null)
  const [isAutoSaveReady, setIsAutoSaveReady] = useState(false)
  const [periodLength, setPeriodLength] = useState(10 * 60)
  const [quarter, setQuarter] = useState(1)
  const [gameSeconds, setGameSeconds] = useState(10 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const courtRef = useRef(null)
  const [showMenu, setShowMenu] = useState(false)
  const [editingLogKey, setEditingLogKey] = useState(null)
  const currentTeamKey = isPro ? activeTeamKey : 'teamA'

  const activeTeam = teams[currentTeamKey]

  const {
    teamName,
    newPlayer,
    bench,
    onCourt,
    shots,
    events,
    selectedPlayer,
    subOutPlayer,
    playerMinutes,
    draggingPlayer,
  } = activeTeam

  const googleProvider = new GoogleAuthProvider()

  const createOrLoadUserProfile = async (firebaseUser) => {
    const userRef = firestoreDoc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: firebaseUser.email || '',
        plan: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return 'free'
    }

    return userSnap.data()?.plan || 'free'
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthUser(null)
        setUserPlan('free')
        setAuthLoading(false)
        return
      }

      setAuthUser(firebaseUser)

      try {
        const plan = await createOrLoadUserProfile(firebaseUser)
        setUserPlan(plan)
      } catch (error) {
        console.error('User profile load failed:', error)

        setUserPlan('free')

        alert(
          `ログインは成功しましたが、ユーザー情報の取得に失敗しました。\n\nエラーコード：${error.code || 'unknown'}`
        )
      } finally {
        setAuthLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleEmailAuth = async (event) => {
    event.preventDefault()

    if (!authEmail || !authPassword) {
      alert('メールアドレスとパスワードを入力してください。')
      return
    }

    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword)
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword)
      }
    } catch (error) {
      console.error('Email auth failed:', error)

      let message = 'ログインまたは新規登録に失敗しました。'

      if (error.code === 'auth/email-already-in-use') {
        message = 'このメールアドレスはすでに登録されています。「ログインはこちら」からログインしてください。'
      }

      if (error.code === 'auth/weak-password') {
        message = 'パスワードは6文字以上にしてください。'
      }

      if (error.code === 'auth/invalid-email') {
        message = 'メールアドレスの形式が正しくありません。'
      }

      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        message = 'メールアドレスまたはパスワードが違います。新規登録済みか確認してください。'
      }

      if (error.code === 'auth/operation-not-allowed') {
        message = 'Firebaseでメール/パスワードログインが有効になっていません。'
      }

      if (error.code === 'auth/configuration-not-found') {
        message = 'Firebase Authenticationの設定が完了していない可能性があります。'
      }

      alert(`${message}\n\nエラーコード：${error.code || 'unknown'}`)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error(error)
      alert('Googleログインに失敗しました。')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error(error)
      alert('ログアウトできませんでした。')
    }
  }

  const handleCheckout = async () => {
    if (!authUser) {
      setShowAuthPanel(true)
      return
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: authUser.uid,
          email: authUser.email,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error || `Checkout session failed: ${response.status}`
        )
      }

      window.location.href = data.url
    } catch (error) {
      console.error(error)
      alert(`購入ページを開けませんでした。\n\n${error.message}`)
    }
  }


  const hasGameDataToSave = (targetTeams) => {
    const teamList = Object.values(targetTeams || {})

    return teamList.some((targetTeam) => {
      const rosterCount =
        (targetTeam.bench?.length || 0) +
        (targetTeam.onCourt?.length || 0)

      const shotCount = targetTeam.shots?.length || 0
      const eventCount = targetTeam.events?.length || 0

      const hasCustomTeamName =
        targetTeam.teamName &&
        !['HOME', 'AWAY'].includes(targetTeam.teamName)

      return (
        rosterCount > 0 ||
        shotCount > 0 ||
        eventCount > 0 ||
        hasCustomTeamName
      )
    })
  }

  const updateTeamField = (teamKey, field, nextValue) => {
    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      const resolvedValue =
        typeof nextValue === 'function'
          ? nextValue(targetTeam[field])
          : nextValue

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          [field]: resolvedValue,
        },
      }
    })
  }

  const updateActiveTeamField = (field, nextValue) => {
    updateTeamField(currentTeamKey, field, nextValue)
  }

  const setTeamName = (nextValue) =>
    updateActiveTeamField('teamName', nextValue)

  const setNewPlayer = (nextValue) =>
    updateActiveTeamField('newPlayer', nextValue)

  const setBench = (nextValue) =>
    updateActiveTeamField('bench', nextValue)

  const setOnCourt = (nextValue) =>
    updateActiveTeamField('onCourt', nextValue)

  const setShots = (nextValue) =>
    updateActiveTeamField('shots', nextValue)

  const setEvents = (nextValue) =>
    updateActiveTeamField('events', nextValue)

  const setSelectedPlayer = (nextValue) =>
    updateActiveTeamField('selectedPlayer', nextValue)

  const setSubOutPlayer = (nextValue) =>
    updateActiveTeamField('subOutPlayer', nextValue)

  const setPlayerMinutes = (nextValue) =>
    updateActiveTeamField('playerMinutes', nextValue)

  const setDraggingPlayer = (nextValue) =>
    updateActiveTeamField('draggingPlayer', nextValue)



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

  const getPlayerTotalSecondsForTeam = (teamKey, number) => {
    const data = teams[teamKey].playerMinutes[number]

    if (!data) return 0

    if (data.currentInAt !== null) {
      return data.totalSeconds + Math.max(0, data.currentInAt - gameSeconds)
    }

    return data.totalSeconds
  }

  const getPlayerTotalSeconds = (number) => {
    return getPlayerTotalSecondsForTeam(currentTeamKey, number)
  }

  const getTeamScore = (teamKey) => {
    return teams[teamKey].shots.reduce((total, shot) => {
      if (shot.result !== 'make') return total

      if (shot.shotType === '3PT') return total + 3
      if (shot.shotType === '2PT') return total + 2
      if (shot.shotType === 'FT') return total + 1

      return total
    }, 0)
  }

  const drawShotChartOnPdf = (doc, playerNumber, x, y, shotSource = shots) => {
    const chartW = 150
    const chartH = 108

    // pdf-court.png内の余白補正
    const courtPadX = -7
    const courtPadY = -1
    const courtScaleX = 1.11
    const courtScaleY = 1.02

    doc.addImage('/pdf-court.png', 'PNG', x, y, chartW, chartH)

    const playerShots = shotSource.filter(
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

  useEffect(() => {
    if (!videoRef.current) return

    if (cameraStream) {
      videoRef.current.srcObject = cameraStream
    } else {
      videoRef.current.srcObject = null
    }
  }, [cameraStream])

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])



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
  const startCamera = async () => {
    if (!isPro) return

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('このブラウザではカメラを使用できません')
      return
    }

    if (!selectedCameraId) {
      alert('使用するカメラを選択してください')
      return
    }

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: {
            exact: selectedCameraId,
          },
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
        },
        audio: false,
      })

      setVideoUrl(null)
      setCameraStream(stream)
      setIsCameraActive(true)

      await loadCameraDevices()
    } catch (error) {
      console.error(error)
      alert('選択したカメラを起動できませんでした。接続・許可・使用中のアプリを確認してください。')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }

    setCameraStream(null)
    setIsCameraActive(false)
  }

  const loadCameraDevices = async () => {
    if (!isPro) return

    if (!navigator.mediaDevices?.enumerateDevices) {
      alert('このブラウザではカメラ一覧を取得できません')
      return
    }

    try {
      let permissionStream = null

      try {
        permissionStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      } catch (permissionError) {
        console.warn(permissionError)
      }

      if (permissionStream) {
        permissionStream.getTracks().forEach((track) => track.stop())
      }

      const devices = await navigator.mediaDevices.enumerateDevices()

      const videoDevices = devices.filter(
        (device) =>
          device.kind === 'videoinput' &&
          device.deviceId
      )

      setCameraDevices(videoDevices)

      setSelectedCameraId((prev) => {
        if (videoDevices.some((device) => device.deviceId === prev)) {
          return prev
        }

        if (videoDevices.length === 1) {
          return videoDevices[0].deviceId
        }

        return ''
      })
    } catch (error) {
      console.error(error)
      alert('カメラ一覧を取得できませんでした')
    }
  }

  const handleVideoDrop = (e) => {
    e.preventDefault()

    const file = e.dataTransfer.files[0]

    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('動画ファイルを選択してください')
      return
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }

    setCameraStream(null)
    setIsCameraActive(false)

    const url = URL.createObjectURL(file)
    setVideoUrl(url)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleCourtClickForTeam = (teamKey, e) => {
    const team = teams[teamKey]
    const targetPlayer = team.selectedPlayer

    if (!targetPlayer) {
      alert('ON COURTの選手を選択してください')
      return
    }

    setActiveTeamKey(teamKey)

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
      teamKey,
      player: targetPlayer,
      x: svgPoint.x,
      y: svgPoint.y,
      shotType,
      result: 'pending',
      quarter,
      clock: formatTime(gameSeconds),
      note: '',
    }

    updateTeamField(teamKey, 'shots', (prevShots) => [
      ...prevShots,
      newShot,
    ])
  }


  const handleCourtClick = (e) => {
    handleCourtClickForTeam(currentTeamKey, e)
  }

  const addFreeThrow = () => {
    if (!selectedPlayer) {
      alert('ON COURTの選手を選択してください')
      return
    }

    const newShot = {
      id: Date.now(),
      teamKey: currentTeamKey,
      player: selectedPlayer,
      x: null,
      y: null,
      shotType: 'FT',
      result: 'pending',
      quarter,
      clock: formatTime(gameSeconds),
      note: '',
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
      teamKey: currentTeamKey,
      player: selectedPlayer,
      eventType,
      quarter,
      clock: formatTime(gameSeconds),
      note: '',
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

  const getPdfShotText = (shot) => {
    if (shot.result === 'make') return `${shot.shotType} MADE`
    if (shot.result === 'miss') return `${shot.shotType} MISS`
    return `${shot.shotType} PENDING`
  }

  const buildPdfLogNoteRows = () => {
    const targetTeamKeys = isPro ? ['teamB', 'teamA'] : [currentTeamKey]

    return targetTeamKeys
      .flatMap((teamKey) => {
        const team = teams[teamKey]
        const teamLabel = getPdfTeamName(teamKey)

        return [
          ...team.shots.map((shot) => ({
            id: shot.id,
            teamKey,
            teamLabel,
            quarter: shot.quarter,
            clock: shot.clock,
            player: shot.player,
            action: getPdfShotText(shot),
            note: shot.note || '',
          })),

          ...team.events.map((event) => ({
            id: event.id,
            teamKey,
            teamLabel,
            quarter: event.quarter,
            clock: event.clock,
            player: event.player,
            action: event.eventType,
            note: event.note || '',
          })),
        ]
      })
      .filter((row) => row.note.trim() !== '')
      .sort((a, b) => a.id - b.id)
  }

  const wrapPdfMemoText = (text, maxWidth, fontSize = 7) => {
    const scale = 4
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    ctx.font = `${fontSize * scale}px sans-serif`

    const maxPx = maxWidth * scale
    const lines = []

    const paragraphs = String(text || '').replace(/\r/g, '').split('\n')

    paragraphs.forEach((paragraph) => {
      let line = ''

      Array.from(paragraph).forEach((char) => {
        const testLine = line + char

        if (ctx.measureText(testLine).width > maxPx && line) {
          lines.push(line)
          line = char
        } else {
          line = testLine
        }
      })

      if (line) {
        lines.push(line)
      }
    })

    return lines.length > 0 ? lines : ['']
  }

  const drawWrappedPdfTextAsImage = (
    pdf,
    text,
    x,
    y,
    maxWidth,
    fontSize = 7,
    preparedLines = null
  ) => {
    const scale = 4
    const padding = 1.5
    const lineHeight = fontSize * 1.35
    const lines = preparedLines || wrapPdfMemoText(text, maxWidth, fontSize)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = (maxWidth + padding * 2) * scale
    canvas.height = (lines.length * lineHeight + padding * 2) * scale

    ctx.font = `${fontSize * scale}px sans-serif`
    ctx.fillStyle = '#071a3a'
    ctx.textBaseline = 'top'

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        padding * scale,
        (padding + index * lineHeight) * scale
      )
    })

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      x,
      y,
      canvas.width / scale,
      canvas.height / scale
    )
  }

  const addLogNotesToPdf = (pdf) => {
    const rows = buildPdfLogNoteRows()

    if (rows.length === 0) return

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const marginX = 14
    const rowWidth = pageWidth - marginX * 2
    const noteX = marginX + 7
    const noteWidth = rowWidth - 14

    const drawPageHeader = () => {
      pdf.setTextColor(7, 26, 58)
      pdf.setFontSize(16)
      pdf.text('Play Log & Notes', marginX, 18)

      pdf.setFontSize(9)
      pdf.setTextColor(110, 110, 110)
      pdf.text('Only logs with notes are shown.', marginX, 25)

      return 34
    }

    pdf.addPage()

    let y = drawPageHeader()

    rows.forEach((row) => {
      const qLabel =
        row.quarter <= 4 ? `Q${row.quarter}` : `OT${row.quarter - 4}`

      const noteLines = wrapPdfMemoText(row.note, noteWidth, 7)
      const rowHeight = Math.max(24, 15 + noteLines.length * 6)

      if (y + rowHeight > pageHeight - 14) {
        pdf.addPage()
        y = drawPageHeader()
      }

      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(225, 225, 225)
      pdf.roundedRect(marginX, y, rowWidth, rowHeight, 3, 3, 'FD')

      if (row.teamKey === 'teamA') {
        pdf.setDrawColor(201, 145, 45)
      } else {
        pdf.setDrawColor(7, 26, 58)
      }

      pdf.setLineWidth(1.4)
      pdf.line(marginX + 2.5, y + 3, marginX + 2.5, y + rowHeight - 3)

      pdf.setTextColor(7, 26, 58)
      pdf.setFontSize(8)

      pdf.text(
        `${qLabel} ${row.clock || '--:--'}${row.teamLabel ? `  ${row.teamLabel}` : ''}  #${row.player}  ${row.action}`,
        noteX,
        y + 7
      )

      drawWrappedPdfTextAsImage(
        pdf,
        row.note,
        noteX,
        y + 10,
        noteWidth,
        7,
        noteLines
      )

      y += rowHeight + 4
    })
  }

  const getPdfTeamName = (teamKey) => {
    const name = (teams[teamKey].teamName || '').trim()

    if (name === 'HOME' || name === 'AWAY') {
      return ''
    }

    return name
  }

  const getPdfPercent = (madeCount, attemptCount) => {
    if (attemptCount === 0) return '-'
    return `${Math.round((madeCount / attemptCount) * 100)}%`
  }

  const getPdfMadeCount = (shotList) => {
    return shotList.filter((shot) => shot.result === 'make').length
  }

  const buildPdfPlayerStatRow = (teamKey, player) => {
    const team = teams[teamKey]

    const playerShots = team.shots.filter(
      (shot) =>
        shot.player === player &&
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

    const fgM = getPdfMadeCount(fgShots)
    const twoM = getPdfMadeCount(twoPtShots)
    const threeM = getPdfMadeCount(threePtShots)
    const ftM = getPdfMadeCount(ftShots)

    const points = twoM * 2 + threeM * 3 + ftM

    const playerEvents = team.events.filter(
      (event) => event.player === player
    )

    const countEvent = (eventType) =>
      playerEvents.filter(
        (event) => event.eventType === eventType
      ).length

    const orb = countEvent('ORB')
    const drb = countEvent('DRB')

    return [
      `#${player}`,
      formatMinutes(getPlayerTotalSecondsForTeam(teamKey, player)),
      points,
      `${fgM}/${fgShots.length}`,
      getPdfPercent(fgM, fgShots.length),
      `${twoM}/${twoPtShots.length}`,
      getPdfPercent(twoM, twoPtShots.length),
      `${threeM}/${threePtShots.length}`,
      getPdfPercent(threeM, threePtShots.length),
      `${ftM}/${ftShots.length}`,
      getPdfPercent(ftM, ftShots.length),
      orb,
      drb,
      orb + drb,
      countEvent('AST'),
      countEvent('STL'),
      countEvent('BLK'),
      countEvent('TOV'),
      countEvent('PF'),
    ]
  }

  const buildPdfPlayerRows = (teamKey) => {
    const team = teams[teamKey]
    const players = [...team.onCourt, ...team.bench]

    return [...players]
      .sort((a, b) => Number(a) - Number(b))
      .map((player) => buildPdfPlayerStatRow(teamKey, player))
  }

  const buildPdfTeamTotalRow = (teamKey) => {
    const team = teams[teamKey]

    const completedShots = team.shots.filter(
      (shot) => shot.result !== 'pending'
    )

    const fgShots = completedShots.filter(
      (shot) => shot.shotType !== 'FT'
    )

    const twoPtShots = completedShots.filter(
      (shot) => shot.shotType === '2PT'
    )

    const threePtShots = completedShots.filter(
      (shot) => shot.shotType === '3PT'
    )

    const ftShots = completedShots.filter(
      (shot) => shot.shotType === 'FT'
    )

    const fgM = getPdfMadeCount(fgShots)
    const twoM = getPdfMadeCount(twoPtShots)
    const threeM = getPdfMadeCount(threePtShots)
    const ftM = getPdfMadeCount(ftShots)

    const countTeamEvent = (eventType) =>
      team.events.filter((event) => event.eventType === eventType).length

    const orb = countTeamEvent('ORB')
    const drb = countTeamEvent('DRB')

    return [
      getPdfTeamName(teamKey),
      twoM * 2 + threeM * 3 + ftM,
      `${fgM}/${fgShots.length}`,
      getPdfPercent(fgM, fgShots.length),
      `${twoM}/${twoPtShots.length}`,
      getPdfPercent(twoM, twoPtShots.length),
      `${threeM}/${threePtShots.length}`,
      getPdfPercent(threeM, threePtShots.length),
      `${ftM}/${ftShots.length}`,
      getPdfPercent(ftM, ftShots.length),
      orb,
      drb,
      orb + drb,
      countTeamEvent('AST'),
      countTeamEvent('STL'),
      countTeamEvent('BLK'),
      countTeamEvent('TOV'),
      countTeamEvent('PF'),
    ]
  }

  const exportProPdf = () => {
    const pdf = new jsPDF('l', 'mm', 'a4')
    const teamKeys = ['teamB', 'teamA']
    const pageHeight = pdf.internal.pageSize.getHeight()

    pdf.setFontSize(18)
    pdf.setTextColor(7, 26, 58)
    pdf.text('PlayPulse Pro Game Report', 14, 18)

    const matchupText = [
      getPdfTeamName('teamB'),
      getPdfTeamName('teamA'),
    ].filter(Boolean).join(' vs ')

    if (matchupText) {
      drawTextAsImage(
        pdf,
        matchupText,
        14,
        22,
        8
      )
    }

    let y = matchupText ? 50 : 34

    pdf.setFontSize(14)
    pdf.setTextColor(7, 26, 58)
    pdf.text('Team Total', 14, y)

    autoTable(pdf, {
      startY: y + 6,
      head: [[
        'Team', 'PTS', 'FG', 'FG%', '2PT', '2PT%', '3PT', '3PT%', 'FT', 'FT%',
        'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'
      ]],
      body: teamKeys.map((teamKey) => buildPdfTeamTotalRow(teamKey)),
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
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

    y = pdf.lastAutoTable.finalY + 14

    teamKeys.forEach((teamKey, index) => {
      if (index > 0 && y > pageHeight - 80) {
        pdf.addPage()
        y = 18
      }

      const pdfTeamName = getPdfTeamName(teamKey)

      pdf.setFontSize(14)
      pdf.setTextColor(7, 26, 58)
      pdf.text('Player Stats', 14, y)

      if (pdfTeamName) {
        drawTextAsImage(pdf, pdfTeamName, 14, y + 5, 5)
      }

      const playerRows = buildPdfPlayerRows(teamKey)

      autoTable(pdf, {
        startY: pdfTeamName ? y + 15 : y + 8,
        head: [[
          'Player', 'MIN', 'PTS', 'FG', 'FG%', '2PT', '2PT%', '3PT', '3PT%', 'FT', 'FT%',
          'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'
        ]],
        body: playerRows.length > 0 ? playerRows : [[
          '-', '-', 0, '0/0', '-', '0/0', '-', '0/0', '-', '0/0', '-',
          0, 0, 0, 0, 0, 0, 0, 0
        ]],
        theme: 'grid',
        styles: {
          fontSize: 6.5,
          cellPadding: 1.4,
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

      y = pdf.lastAutoTable.finalY + 14
    })

    teamKeys.forEach((teamKey) => {
      const team = teams[teamKey]
      const players = [...team.onCourt, ...team.bench]

      const playersWithShots = [...players]
        .filter((player) =>
          team.shots.some(
            (shot) =>
              shot.player === player &&
              shot.shotType !== 'FT' &&
              shot.result !== 'pending'
          )
        )
        .sort((a, b) => Number(a) - Number(b))

      playersWithShots.forEach((player) => {
        pdf.addPage()

        const chartX = 14
        const titleY = 18
        const teamNameY = 22
        const chartY = 34
        const pdfTeamName = getPdfTeamName(teamKey)

        pdf.setTextColor(7, 26, 58)
        pdf.setFontSize(12)
        pdf.text(`#${player} Shot Chart`, chartX, titleY)

        if (pdfTeamName) {
          drawTextAsImage(pdf, pdfTeamName, chartX, teamNameY, 4)
        }

        drawShotChartOnPdf(pdf, player, chartX, chartY, team.shots)
      })
    })

    addLogNotesToPdf(pdf)

    pdf.save('playpulse-pro-report.pdf')
  }

  const saveGameData = () => {
    if (!isPro) return

    try {
      const saveData = {
        version: 1,
        savedAt: new Date().toISOString(),

        activeTeamKey,
        teams,

        quarter,
        gameSeconds,
        periodLength,

        isTimerRunning: false,
      }

      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(saveData))

      alert('試合データを保存しました。動画・カメラ映像は保存されません。')
    } catch (error) {
      console.error(error)
      alert('試合データを保存できませんでした。')
    }
  }

  useEffect(() => {
    if (!isPro) return

    const timerId = window.setTimeout(() => {
      setIsAutoSaveReady(true)
    }, 1500)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [isPro])

  useEffect(() => {
    if (!isPro) return
    if (!isAutoSaveReady) return
    if (!hasGameDataToSave(teams)) return

    const timeoutId = window.setTimeout(() => {
      try {
        const saveData = {
          version: 1,
          savedAt: new Date().toISOString(),

          activeTeamKey,
          teams,

          quarter,
          gameSeconds,
          periodLength,

          isTimerRunning: false,
        }

        localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(saveData))
        setLastAutoSavedAt(new Date())
      } catch (error) {
        console.error('Auto save failed:', error)
      }
    }, 700)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    isPro,
    isAutoSaveReady,
    activeTeamKey,
    teams,
    quarter,
    gameSeconds,
    periodLength,
  ])

  const loadGameData = () => {
    if (!isPro) return

    const rawData = localStorage.getItem(GAME_STORAGE_KEY)

    if (!rawData) {
      alert('保存済みの試合データがありません。')
      return
    }

    const shouldLoad = window.confirm(
      '保存済みの試合データを読み込みます。現在の入力内容は上書きされます。'
    )

    if (!shouldLoad) return

    try {
      const savedData = JSON.parse(rawData)

      if (!savedData?.teams?.teamA || !savedData?.teams?.teamB) {
        alert('保存データの形式が正しくありません。')
        return
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }

      setCameraStream(null)
      setIsCameraActive(false)
      setVideoUrl(null)

      setIsTimerRunning(false)

      setTeams(savedData.teams)
      setActiveTeamKey(savedData.activeTeamKey || 'teamA')

      setQuarter(savedData.quarter || 1)
      setPeriodLength(savedData.periodLength || 10 * 60)
      setGameSeconds(
        Number.isFinite(savedData.gameSeconds)
          ? savedData.gameSeconds
          : savedData.periodLength || 10 * 60
      )

      alert('試合データを読み込みました。動画は必要に応じて再度読み込んでください。')
    } catch (error) {
      console.error(error)
      alert('試合データを読み込めませんでした。')
    }
  }

  const exportGameData = () => {
    if (!isPro) return

    try {
      const saveData = {
        version: 1,
        savedAt: new Date().toISOString(),

        activeTeamKey,
        teams,

        quarter,
        gameSeconds,
        periodLength,

        isTimerRunning: false,
      }

      const jsonText = JSON.stringify(saveData, null, 2)
      const blob = new Blob([jsonText], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      const dateText = new Date().toISOString().slice(0, 10)

      link.href = url
      link.download = `playpulse-game-${dateText}.json`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('試合データを書き出せませんでした。')
    }
  }

  const importGameData = (event) => {
    if (!isPro) return

    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('JSONファイルを選択してください。')
      return
    }

    const shouldLoad = window.confirm(
      'JSONファイルから試合データを読み込みます。現在の入力内容は上書きされます。'
    )

    if (!shouldLoad) return

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const savedData = JSON.parse(String(reader.result || ''))

        if (!savedData?.teams?.teamA || !savedData?.teams?.teamB) {
          alert('読み込んだファイルの形式が正しくありません。')
          return
        }

        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop())
        }

        setCameraStream(null)
        setIsCameraActive(false)
        setVideoUrl(null)

        setIsTimerRunning(false)

        setTeams(savedData.teams)
        setActiveTeamKey(savedData.activeTeamKey || 'teamA')

        setQuarter(savedData.quarter || 1)
        setPeriodLength(savedData.periodLength || 10 * 60)
        setGameSeconds(
          Number.isFinite(savedData.gameSeconds)
            ? savedData.gameSeconds
            : savedData.periodLength || 10 * 60
        )

        localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(savedData))

        alert('試合データを読み込みました。動画は必要に応じて再度読み込んでください。')
      } catch (error) {
        console.error(error)
        alert('試合データを読み込めませんでした。')
      }
    }

    reader.onerror = () => {
      alert('ファイルを読み込めませんでした。')
    }

    reader.readAsText(file)
  }

  const exportPdf = () => {
    console.log('PDF button clicked')

    if (isPro) {
      exportProPdf()
      return
    }

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

    addLogNotesToPdf(pdf)

    pdf.save('playpulse-report.pdf')
  }

  const drawTextAsImage = (pdf, text, x, y, fontSize = 18) => {
    const safeText = String(text || '').trim()

    if (!safeText) return

    const scale = 4
    const fontPx = fontSize * scale
    const paddingX = fontPx * 0.6
    const paddingY = fontPx * 0.35
    const lineHeight = fontPx * 1.45

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    ctx.font = `bold ${fontPx}px sans-serif`

    const textWidth = ctx.measureText(safeText).width

    canvas.width = Math.ceil(textWidth + paddingX * 2)
    canvas.height = Math.ceil(lineHeight + paddingY * 2)

    ctx.font = `bold ${fontPx}px sans-serif`
    ctx.fillStyle = '#071a3a'
    ctx.textBaseline = 'top'
    ctx.fillText(safeText, paddingX, paddingY)

    const imgData = canvas.toDataURL('image/png')

    pdf.addImage(
      imgData,
      'PNG',
      x,
      y,
      canvas.width / scale,
      canvas.height / scale
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

      if (video && !video.srcObject) {
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
  }, [
    shots,
    selectedPlayer,
    events,
    currentTeamKey,
    gameSeconds,
    quarter,
    periodLength,
  ])

  const buildTeamLogs = (teamKey) => {
    const team = teams[teamKey]

    return [
      ...team.shots.map((shot) => ({
        id: shot.id,
        logKey: `${teamKey}-shot-${shot.id}`,
        logType: 'shot',
        teamKey,
        targetTeamKey: teamKey,
        player: shot.player,
        text: `${shot.shotType} ${shot.result === 'make'
          ? 'MADE'
          : shot.result === 'miss'
            ? 'MISS'
            : 'PENDING'
          }`,
        clock: shot.clock,
        note: shot.note || '',
      })),

      ...team.events.map((event) => ({
        id: event.id,
        logKey: `${teamKey}-event-${event.id}`,
        logType: 'event',
        teamKey,
        targetTeamKey: teamKey,
        player: event.player,
        text: event.eventType,
        clock: event.clock,
        note: event.note || '',
      })),
    ]
  }

  const newestLogs = isPro
    ? [
      ...buildTeamLogs('teamB'),
      ...buildTeamLogs('teamA'),
    ].sort((a, b) => b.id - a.id)
    : [
      ...shots.map((shot) => ({
        id: shot.id,
        logKey: `free-shot-${shot.id}`,
        logType: 'shot',
        teamKey: null,
        targetTeamKey: currentTeamKey,
        player: shot.player,
        text: `${shot.shotType} ${shot.result === 'make'
          ? 'MADE'
          : shot.result === 'miss'
            ? 'MISS'
            : 'PENDING'
          }`,
        clock: shot.clock,
        note: shot.note || '',
      })),

      ...events.map((event) => ({
        id: event.id,
        logKey: `free-event-${event.id}`,
        logType: 'event',
        teamKey: null,
        targetTeamKey: currentTeamKey,
        player: event.player,
        text: event.eventType,
        clock: event.clock,
        note: event.note || '',
      })),
    ].sort((a, b) => b.id - a.id)

  const updateLogNote = (log, note) => {
    const targetTeamKey = log.targetTeamKey || currentTeamKey
    const targetField = log.logType === 'shot' ? 'shots' : 'events'

    updateTeamField(targetTeamKey, targetField, (prevItems) =>
      prevItems.map((item) =>
        item.id === log.id
          ? {
            ...item,
            note,
          }
          : item
      )
    )
  }

  const visibleShots = selectedPlayer
    ? shots.filter(
      (shot) =>
        shot.player === selectedPlayer &&
        shot.shotType !== 'FT'
    )
    : shots.filter((shot) => shot.shotType !== 'FT')

  const getVisibleShotsForTeam = (teamKey) => {
    const team = teams[teamKey]

    return team.selectedPlayer
      ? team.shots.filter(
        (shot) =>
          shot.player === team.selectedPlayer &&
          shot.shotType !== 'FT'
      )
      : team.shots.filter((shot) => shot.shotType !== 'FT')
  }

  const selectedStats = calculateSelectedStats()

  const addPlayerForTeam = (teamKey) => {
    const team = teams[teamKey]
    const number = team.newPlayer.trim()

    if (!number) return

    if (team.bench.includes(number) || team.onCourt.includes(number)) {
      alert('同じチーム内で同じ背番号は登録できません')
      return
    }

    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          bench: [...targetTeam.bench, number],
          newPlayer: '',
          playerMinutes: {
            ...targetTeam.playerMinutes,
            [number]: {
              totalSeconds: 0,
              currentInAt: null,
            },
          },
        },
      }
    })
  }

  const selectPlayerForTeam = (teamKey, number) => {
    setActiveTeamKey(teamKey)

    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          selectedPlayer: number,
          subOutPlayer: number,
        },
      }
    })
  }

  const handleBenchClickForTeam = (teamKey, number) => {
    setActiveTeamKey(teamKey)

    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      if (targetTeam.subOutPlayer) {
        const outPlayer = targetTeam.subOutPlayer

        const outData = targetTeam.playerMinutes[outPlayer] || {
          totalSeconds: 0,
          currentInAt: gameSeconds,
        }

        const playedSeconds = Math.max(
          0,
          outData.currentInAt - gameSeconds
        )

        return {
          ...prev,
          [teamKey]: {
            ...targetTeam,
            playerMinutes: {
              ...targetTeam.playerMinutes,
              [outPlayer]: {
                totalSeconds: outData.totalSeconds + playedSeconds,
                currentInAt: null,
              },
              [number]: {
                totalSeconds:
                  targetTeam.playerMinutes[number]?.totalSeconds || 0,
                currentInAt: gameSeconds,
              },
            },
            onCourt: targetTeam.onCourt.map((player) =>
              player === outPlayer ? number : player
            ),
            bench: [
              ...targetTeam.bench.filter((player) => player !== number),
              outPlayer,
            ],
            selectedPlayer: number,
            subOutPlayer: null,
          },
        }
      }

      if (targetTeam.onCourt.length >= 5) return prev

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          playerMinutes: {
            ...targetTeam.playerMinutes,
            [number]: {
              totalSeconds:
                targetTeam.playerMinutes[number]?.totalSeconds || 0,
              currentInAt: gameSeconds,
            },
          },
          bench: targetTeam.bench.filter((player) => player !== number),
          onCourt: [...targetTeam.onCourt, number],
          selectedPlayer: number,
        },
      }
    })
  }

  const handlePlayerDropForTeam = (teamKey, benchPlayer) => {
    setActiveTeamKey(teamKey)

    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      if (!targetTeam.draggingPlayer) return prev

      const outPlayer = targetTeam.draggingPlayer

      const outData = targetTeam.playerMinutes[outPlayer] || {
        totalSeconds: 0,
        currentInAt: gameSeconds,
      }

      const playedSeconds = Math.max(
        0,
        outData.currentInAt - gameSeconds
      )

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          playerMinutes: {
            ...targetTeam.playerMinutes,
            [outPlayer]: {
              totalSeconds: outData.totalSeconds + playedSeconds,
              currentInAt: null,
            },
            [benchPlayer]: {
              totalSeconds:
                targetTeam.playerMinutes[benchPlayer]?.totalSeconds || 0,
              currentInAt: gameSeconds,
            },
          },
          onCourt: targetTeam.onCourt.map((player) =>
            player === outPlayer ? benchPlayer : player
          ),
          bench: [
            ...targetTeam.bench.filter((player) => player !== benchPlayer),
            outPlayer,
          ],
          selectedPlayer: benchPlayer,
          draggingPlayer: null,
        },
      }
    })
  }

  const deletePlayerForTeam = (teamKey) => {
    const team = teams[teamKey]
    const player = team.newPlayer.trim()

    if (!player) return

    if (team.onCourt.includes(player)) {
      alert('ON COURTの選手は削除できません')
      return
    }

    setTeams((prev) => {
      const targetTeam = prev[teamKey]

      return {
        ...prev,
        [teamKey]: {
          ...targetTeam,
          bench: targetTeam.bench.filter((p) => p !== player),
          selectedPlayer:
            targetTeam.selectedPlayer === player
              ? null
              : targetTeam.selectedPlayer,
          newPlayer: '',
        },
      }
    })
  }

  const renderTeamRoster = (teamKey) => {
    const team = teams[teamKey]
    const isRecordingTeam = activeTeamKey === teamKey

    return (
      <div
        className={
          isRecordingTeam
            ? 'roster-card pro-team-roster recording-team'
            : 'roster-card pro-team-roster'
        }
      >
        <h2>ROSTER</h2>

        <div className="selected-player">
          {isRecordingTeam && team.selectedPlayer
            ? `RECORDING #${team.selectedPlayer}`
            : 'SELECT PLAYER'}
        </div>

        <div className="roster-section">
          <h3>ON COURT ({team.onCourt.length}/5)</h3>

          <div className="player-list">
            {team.onCourt.map((number) => (
              <button
                key={`${teamKey}-on-${number}`}
                className={
                  team.subOutPlayer === number
                    ? 'player-chip sub-out'
                    : isRecordingTeam && team.selectedPlayer === number
                      ? 'player-chip selected'
                      : 'player-chip active'
                }
                onClick={() => selectPlayerForTeam(teamKey, number)}
                draggable
                onDragStart={() =>
                  updateTeamField(teamKey, 'draggingPlayer', number)
                }
                onDragEnd={() =>
                  updateTeamField(teamKey, 'draggingPlayer', null)
                }
              >
                {number}
              </button>
            ))}
          </div>
        </div>

        <div className="roster-section">
          <h3>
            BENCH
            {team.subOutPlayer && (
              <span className="sub-hint">
                {' '}→ SELECT IN PLAYER
              </span>
            )}
          </h3>

          <div className="player-list bench-list">
            {team.bench.map((number) => (
              <button
                key={`${teamKey}-bench-${number}`}
                className="player-chip"
                onClick={() => handleBenchClickForTeam(teamKey, number)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handlePlayerDropForTeam(teamKey, number)}
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
            value={team.newPlayer}
            onChange={(e) =>
              updateTeamField(teamKey, 'newPlayer', e.target.value)
            }
          />

          <button onClick={() => addPlayerForTeam(teamKey)}>+</button>

          <button
            className="delete-btn"
            onClick={() => deletePlayerForTeam(teamKey)}
          >
            −
          </button>
        </div>
      </div>
    )
  }
  const renderTeamSidePanel = (teamKey) => {
    const team = teams[teamKey]

    return (
      <>
        <div className="team-name-card">
          <input
            value={team.teamName}
            onChange={(e) =>
              updateTeamField(teamKey, 'teamName', e.target.value)
            }
            className="team-name-input"
          />
        </div>

        <div className="chart-card chart-only">
          <Court
            shots={getVisibleShotsForTeam(teamKey)}
            onCourtClick={(e) => handleCourtClickForTeam(teamKey, e)}
          />
        </div>

        {renderTeamRoster(teamKey)}
      </>
    )
  }

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>PlayPulse</h1>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (showAuthPanel && !authUser) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>PlayPulse</h1>
          <p>ログインしてPlayPulse Proを使用します。</p>

          <form onSubmit={handleEmailAuth} className="auth-form">
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="メールアドレス"
            />

            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="パスワード"
            />

            <button type="submit">
              {authMode === 'signup' ? '新規登録' : 'ログイン'}
            </button>
          </form>

          <button
            type="button"
            className="auth-google-button"
            onClick={handleGoogleLogin}
          >
            Googleでログイン
          </button>

          <button
            type="button"
            className="auth-switch-button"
            onClick={() =>
              setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
            }
          >
            {authMode === 'signup'
              ? 'ログインはこちら'
              : '新規登録はこちら'}
          </button>

          <button
            type="button"
            className="auth-switch-button"
            onClick={() => setShowAuthPanel(false)}
          >
            無料版に戻る
          </button>
        </div>
      </div>
    )
  }

  if (showAuthPanel && authUser) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>PlayPulse Pro</h1>
        <p>ログイン中：{authUser.email}</p>
        <p>現在のプラン：{isPro ? 'PRO' : 'FREE'}</p>

        {isPro ? (
          <p className="auth-note">
            現在、PlayPulse Proをご利用中です。
          </p>
        ) : (
          <>
            <p className="auth-note">
              PlayPulse Proは月額1,100円（税込）でご利用いただけます。
              解約後も、すでにお支払い済みの期間が終了するまではPro機能をご利用いただけます。
            </p>

            <button
              type="button"
              className="auth-google-button"
              onClick={handleCheckout}
            >
              月額1,100円で購入する
            </button>
          </>
        )}

        <button
          type="button"
          className="auth-google-button"
          onClick={handleLogout}
        >
          ログアウト
        </button>

        <button
          type="button"
          className="auth-switch-button"
          onClick={() => setShowAuthPanel(false)}
        >
          無料版に戻る
        </button>
      </div>
    </div>
  )
}



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

        <div className={isPro ? 'clock-area score-clock-area' : 'clock-area'}>
          {isPro && (
            <div className="header-score">
              {getTeamScore('teamB')}
            </div>
          )}

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

          {isPro && (
            <div className="header-score">
              {getTeamScore('teamA')}
            </div>
          )}
        </div>

        <div className="header-right">
          <button
            type="button"
            className="pro-badge"
            onClick={() => {
              if (!isPro) {
                setShowAuthPanel(true)
              }
            }}
          >
            {isPro ? 'PRO' : 'PROプランへ'}
          </button>

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
        <aside className={isPro ? 'left-ad-panel pro-side-panel' : 'left-ad-panel'}>
          {isPro ? (
            renderTeamSidePanel('teamB')
          ) : (
            <div className="ad-box">
              {!isPro && <AdSenseSidebar />}

              <div className="ad-text">
                Upgrade to PlayPulse Pro
              </div>
            </div>
          )}
        </aside>

        <section className="media-panel">
          <div
            className="video-panel"
            onDrop={handleVideoDrop}
            onDragOver={handleDragOver}
          >
            {isCameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="video-player"
              />
            ) : videoUrl ? (
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

            {isPro && (
              <div className="camera-controls">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                >
                  <option value="">SELECT CAMERA</option>

                  {cameraDevices.map((device, index) => (
                    <option
                      key={device.deviceId || index}
                      value={device.deviceId}
                    >
                      {device.label || `CAMERA ${index + 1}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadCameraDevices}
                >
                  カメラ更新
                </button>

                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                  >
                    CAMERA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                  >
                    STOP
                  </button>
                )}
              </div>
            )}

          </div>

          <div className="inline-log-panel">
            <div className="log-box">
              <div className="panel-title">EVENT LOG</div>

              <div className="event-list">
                {newestLogs.map((log) => (
                  <div key={log.logKey} className="event-log-row">
                    <button
                      type="button"
                      className={
                        log.teamKey === 'teamA'
                          ? 'event-item team-a-log'
                          : log.teamKey === 'teamB'
                            ? 'event-item team-b-log'
                            : 'event-item'
                      }
                      onClick={() =>
                        setEditingLogKey((prev) =>
                          prev === log.logKey ? null : log.logKey
                        )
                      }
                    >
                      <span className="event-time">
                        {log.clock || '--:--'}
                      </span>

                      <span className="event-player">
                        #{log.player}
                      </span>

                      <span className="event-text">
                        {log.text}
                        {log.note && (
                          <span className="memo-badge">
                            MEMO
                          </span>
                        )}
                      </span>
                    </button>

                    {editingLogKey === log.logKey && (
                      <div className="log-memo-editor">
                        <textarea
                          value={log.note}
                          placeholder="このプレーのメモを入力"
                          onChange={(e) => updateLogNote(log, e.target.value)}
                        />
                      </div>
                    )}
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
          {isPro ? (
            renderTeamSidePanel('teamA')
          ) : (
            <>
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
            </>
          )}
        </section>
      </main>

      <footer className="menu-bar">
        <button
          className="pdf-button"
          onClick={exportPdf}
        >
          PDF出力
        </button>

        {isPro && (
          <>
            <button
              type="button"
              className="save-game-button"
              onClick={saveGameData}
            >
              SAVE GAME
            </button>

            <button
              type="button"
              className="load-game-button"
              onClick={loadGameData}
            >
              LOAD GAME
            </button>

            <button
              type="button"
              className="export-game-button"
              onClick={exportGameData}
            >
              EXPORT DATA
            </button>

            <button
              type="button"
              className="import-game-button"
              onClick={() => importGameInputRef.current?.click()}
            >
              IMPORT DATA
            </button>

            <input
              ref={importGameInputRef}
              type="file"
              accept="application/json"
              onChange={importGameData}
              style={{ display: 'none' }}
            />
            {lastAutoSavedAt && (
              <span className="auto-save-status">
                自動保存済み{' '}
                {lastAutoSavedAt.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </>
        )}

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