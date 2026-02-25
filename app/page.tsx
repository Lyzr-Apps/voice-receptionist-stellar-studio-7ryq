'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { crawlWebsite } from '@/lib/ragKnowledgeBase'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FiPhone, FiCalendar, FiClock, FiSearch, FiSettings, FiDatabase, FiMic, FiMicOff, FiPhoneOff, FiActivity, FiUsers, FiHelpCircle, FiChevronRight, FiPlus, FiHome, FiList, FiGlobe, FiCheckCircle, FiAlertCircle, FiArrowUpRight, FiArrowDownRight, FiPhoneCall, FiPhoneIncoming, FiPhoneMissed, FiX } from 'react-icons/fi'

const RAG_ID = '699ef2bea098de59fa3fe5d0'
const VOICE_AGENT_ID = '699ef2fa4aaf7365c1a3dbdf'

// ---- Types ----
interface CallEntry {
  id: string
  callerNumber: string
  duration: string
  durationSeconds: number
  outcome: 'faq' | 'appointment' | 'transfer' | 'missed'
  summary: string
  transcript: string
  timestamp: string
  appointmentDetails?: string
  faqMatched?: string
}

interface TransferRule {
  id: string
  keyword: string
}

interface BusinessHour {
  day: string
  open: string
  close: string
  closed: boolean
}

interface PracticeInfo {
  name: string
  address: string
  phone: string
  insuranceList: string
}

// ---- Demo Data ----
const DEMO_CALLS: CallEntry[] = [
  {
    id: '1', callerNumber: '(555) 234-8901', duration: '3:42', durationSeconds: 222,
    outcome: 'faq', summary: 'Patient asked about office hours and accepted insurance plans.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: Hi, I wanted to know your office hours?\nAgent: Our office is open Monday through Friday from 8 AM to 5 PM, and Saturday from 9 AM to 1 PM. We are closed on Sundays.\nCaller: Do you accept Blue Cross Blue Shield?\nAgent: Yes, we do accept Blue Cross Blue Shield. We also accept Aetna, Cigna, United Healthcare, and Medicare.\nCaller: Great, thank you!\nAgent: You\'re welcome! Is there anything else I can help you with?\nCaller: No, that\'s all. Goodbye.\nAgent: Have a wonderful day!',
    timestamp: '2026-02-25T09:15:00', faqMatched: 'Office hours and insurance coverage'
  },
  {
    id: '2', callerNumber: '(555) 876-5432', duration: '5:18', durationSeconds: 318,
    outcome: 'appointment', summary: 'Booked annual physical exam for March 3rd at 10:00 AM.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I need to schedule my annual physical.\nAgent: I\'d be happy to help you with that. Let me check availability. Would you prefer a morning or afternoon appointment?\nCaller: Morning would be better.\nAgent: I have openings on March 3rd at 10:00 AM or March 5th at 9:30 AM. Which works better for you?\nCaller: March 3rd at 10 AM is perfect.\nAgent: I\'ve booked your annual physical exam for March 3rd at 10:00 AM with Dr. Williams. Please arrive 15 minutes early for paperwork.\nCaller: Thank you so much!',
    timestamp: '2026-02-25T09:48:00', appointmentDetails: 'Annual Physical - March 3, 2026 at 10:00 AM with Dr. Williams'
  },
  {
    id: '3', callerNumber: '(555) 111-2233', duration: '2:05', durationSeconds: 125,
    outcome: 'transfer', summary: 'Patient needed to discuss billing dispute regarding insurance claim.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I received a bill that doesn\'t look right. My insurance should have covered this.\nAgent: I understand your concern about the billing. Let me transfer you to our billing department who can review your account and resolve this for you.\nCaller: Okay, thank you.\nAgent: You\'re welcome. Please hold while I connect you.',
    timestamp: '2026-02-25T10:22:00'
  },
  {
    id: '4', callerNumber: '(555) 444-5566', duration: '1:30', durationSeconds: 90,
    outcome: 'missed', summary: 'Caller disconnected before the agent could assist.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\n[Call disconnected]',
    timestamp: '2026-02-25T10:45:00'
  },
  {
    id: '5', callerNumber: '(555) 789-0123', duration: '4:12', durationSeconds: 252,
    outcome: 'appointment', summary: 'Rescheduled dental cleaning from Feb 28 to March 7 at 2:00 PM.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I need to reschedule my dental cleaning.\nAgent: Of course. Can you provide me with your appointment date?\nCaller: It\'s February 28th.\nAgent: I see your dental cleaning on February 28th. When would you like to reschedule?\nCaller: Sometime the first week of March in the afternoon?\nAgent: I have March 7th at 2:00 PM available. Would that work?\nCaller: Perfect, yes.\nAgent: Done! Your dental cleaning has been rescheduled to March 7th at 2:00 PM.',
    timestamp: '2026-02-25T11:03:00', appointmentDetails: 'Dental Cleaning - March 7, 2026 at 2:00 PM (Rescheduled)'
  },
  {
    id: '6', callerNumber: '(555) 321-6547', duration: '3:55', durationSeconds: 235,
    outcome: 'faq', summary: 'Patient inquired about COVID-19 testing availability and preparation.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: Do you offer COVID testing?\nAgent: Yes, we offer both PCR and rapid antigen testing. PCR results typically take 24-48 hours, while rapid tests provide results in about 15 minutes.\nCaller: Do I need an appointment for a rapid test?\nAgent: Walk-ins are welcome for rapid testing, but we recommend scheduling an appointment to minimize wait times. Testing is available Monday through Friday from 8 AM to 4 PM.\nCaller: Is there any preparation needed?\nAgent: No special preparation is required. Just bring your ID and insurance card.',
    timestamp: '2026-02-25T11:30:00', faqMatched: 'COVID-19 testing information'
  },
  {
    id: '7', callerNumber: '(555) 654-9870', duration: '2:48', durationSeconds: 168,
    outcome: 'transfer', summary: 'Patient requested prescription refill which requires clinical review.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I need to refill my blood pressure medication.\nAgent: I understand you need a prescription refill. For your safety, prescription refills need to be reviewed by our clinical staff. Let me transfer you to our nursing team.\nCaller: Alright, thank you.\nAgent: You\'re welcome. I\'m connecting you now.',
    timestamp: '2026-02-25T12:15:00'
  },
  {
    id: '8', callerNumber: '(555) 987-3210', duration: '6:22', durationSeconds: 382,
    outcome: 'appointment', summary: 'New patient consultation scheduled for March 10 at 11:00 AM.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I\'m a new patient and I\'d like to schedule my first visit.\nAgent: Welcome! We\'d love to have you. For new patients, we schedule a 45-minute consultation. Can you tell me your preferred dates?\nCaller: Sometime next week if possible.\nAgent: I have availability on March 10th at 11:00 AM or March 12th at 3:00 PM. Which do you prefer?\nCaller: March 10th works great.\nAgent: Wonderful! I\'ve scheduled your new patient consultation for March 10th at 11:00 AM. You\'ll receive a confirmation email with new patient forms to complete before your visit.\nCaller: Thank you, I look forward to it.',
    timestamp: '2026-02-25T13:02:00', appointmentDetails: 'New Patient Consultation - March 10, 2026 at 11:00 AM'
  },
  {
    id: '9', callerNumber: '(555) 456-7890', duration: '1:55', durationSeconds: 115,
    outcome: 'faq', summary: 'Caller asked about directions to the office and parking availability.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: Can you tell me where your office is located?\nAgent: We\'re located at 1234 Health Avenue, Suite 200, in the Medical Arts Building. There\'s free parking available in the adjacent garage.\nCaller: Is there handicap parking?\nAgent: Yes, handicap-accessible parking is available on the ground level of the parking garage, closest to the building entrance.\nCaller: Thank you!',
    timestamp: '2026-02-25T13:45:00', faqMatched: 'Office location and parking'
  },
  {
    id: '10', callerNumber: '(555) 222-3344', duration: '7:45', durationSeconds: 465,
    outcome: 'transfer', summary: 'Patient reported urgent symptoms requiring immediate medical advice.',
    transcript: 'Agent: Thank you for calling MedConnect. How can I help you today?\nCaller: I\'ve been having severe chest pain for the past hour.\nAgent: I\'m sorry to hear that. Chest pain can be serious and requires immediate medical attention. I\'m going to transfer you to our on-call nurse right away. If your pain worsens, please hang up and call 911 immediately.\nCaller: Okay, please hurry.\nAgent: Connecting you now. Please stay on the line.',
    timestamp: '2026-02-25T14:20:00'
  }
]

const DEFAULT_TRANSFER_RULES: TransferRule[] = [
  { id: '1', keyword: 'emergency' },
  { id: '2', keyword: 'billing dispute' },
  { id: '3', keyword: 'prescription refill' },
  { id: '4', keyword: 'medical advice' },
  { id: '5', keyword: 'urgent' },
]

const DEFAULT_BUSINESS_HOURS: BusinessHour[] = [
  { day: 'Monday', open: '08:00', close: '17:00', closed: false },
  { day: 'Tuesday', open: '08:00', close: '17:00', closed: false },
  { day: 'Wednesday', open: '08:00', close: '17:00', closed: false },
  { day: 'Thursday', open: '08:00', close: '17:00', closed: false },
  { day: 'Friday', open: '08:00', close: '17:00', closed: false },
  { day: 'Saturday', open: '09:00', close: '13:00', closed: false },
  { day: 'Sunday', open: '09:00', close: '17:00', closed: true },
]

// ---- Outcome helpers ----
function getOutcomeLabel(outcome: string) {
  switch (outcome) {
    case 'faq': return 'FAQ Answered'
    case 'appointment': return 'Appointment Booked'
    case 'transfer': return 'Transferred'
    case 'missed': return 'Missed'
    default: return outcome
  }
}

function getOutcomeBadgeClass(outcome: string) {
  switch (outcome) {
    case 'faq': return 'bg-green-100 text-green-800 border-green-200'
    case 'appointment': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'transfer': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'missed': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getOutcomeIcon(outcome: string) {
  switch (outcome) {
    case 'faq': return <FiHelpCircle className="w-3.5 h-3.5" />
    case 'appointment': return <FiCalendar className="w-3.5 h-3.5" />
    case 'transfer': return <FiUsers className="w-3.5 h-3.5" />
    case 'missed': return <FiPhoneMissed className="w-3.5 h-3.5" />
    default: return <FiPhone className="w-3.5 h-3.5" />
  }
}

function formatTime(isoString: string) {
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

function formatDateTime(isoString: string) {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

// ---- ErrorBoundary ----
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Sidebar Nav Item ----
function SidebarNavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-sans transition-all duration-200 text-left',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-foreground hover:bg-secondary'
      )}
    >
      {icon}
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  )
}

// ---- Metric Card ----
function MetricCard({ icon, label, value, change, changePositive }: { icon: React.ReactNode; label: string; value: number; change: string; changePositive: boolean }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-sans text-muted-foreground tracking-wide">{label}</p>
            <p className="text-3xl font-serif font-bold text-foreground">{value}</p>
            <div className="flex items-center gap-1 text-xs font-sans">
              {changePositive ? (
                <FiArrowUpRight className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <FiArrowDownRight className="w-3.5 h-3.5 text-red-600" />
              )}
              <span className={changePositive ? 'text-green-600' : 'text-red-600'}>{change}</span>
              <span className="text-muted-foreground ml-1">vs yesterday</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Voice Call Modal ----
function VoiceCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended' | 'error'>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([])
  const [callDuration, setCallDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [thinkingText, setThinkingText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMutedRef = useRef(false)
  const nextPlayTimeRef = useRef(0)
  const sampleRateRef = useRef(24000)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcript])

  useEffect(() => {
    return () => {
      endCall()
    }
  }, [])

  const startCall = useCallback(async () => {
    setCallState('connecting')
    setTranscript([])
    setCallDuration(0)
    setErrorMsg('')
    setThinkingText('')
    nextPlayTimeRef.current = 0

    try {
      const res = await fetch('https://voice-sip.studio.lyzr.ai/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: VOICE_AGENT_ID }),
      })

      if (!res.ok) {
        throw new Error('Failed to start voice session')
      }

      const data = await res.json()
      const wsUrl = data?.wsUrl
      const sr = data?.audioConfig?.sampleRate ?? 24000
      sampleRateRef.current = sr

      if (!wsUrl) throw new Error('No WebSocket URL returned')

      const ac = new AudioContext({ sampleRate: sr })
      audioContextRef.current = ac

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const source = ac.createMediaStreamSource(stream)
      const processor = ac.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      const silentGain = ac.createGain()
      silentGain.gain.value = 0
      silentGain.connect(ac.destination)
      source.connect(processor)
      processor.connect(silentGain)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setCallState('active')
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      }

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'audio' && msg.audio) {
            const raw = atob(msg.audio)
            const buffer = new ArrayBuffer(raw.length)
            const view = new Uint8Array(buffer)
            for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)

            const int16 = new Int16Array(buffer)
            const float32 = new Float32Array(int16.length)
            for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

            const audioBuffer = ac.createBuffer(1, float32.length, sr)
            audioBuffer.getChannelData(0).set(float32)

            const sourceNode = ac.createBufferSource()
            sourceNode.buffer = audioBuffer
            sourceNode.connect(ac.destination)

            const now = ac.currentTime
            const startTime = Math.max(now, nextPlayTimeRef.current)
            sourceNode.start(startTime)
            nextPlayTimeRef.current = startTime + audioBuffer.duration
          } else if (msg.type === 'transcript') {
            const role = msg.role === 'user' ? 'You' : 'Agent'
            const text = msg.text ?? msg.transcript ?? ''
            if (text) {
              setTranscript(prev => {
                const last = prev[prev.length - 1]
                if (last && last.role === role && msg.final !== true) {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role, text }
                  return updated
                }
                return [...prev, { role, text }]
              })
            }
            setThinkingText('')
          } else if (msg.type === 'thinking') {
            setThinkingText(msg.text ?? 'Thinking...')
          } else if (msg.type === 'clear') {
            nextPlayTimeRef.current = 0
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message ?? 'Voice agent error')
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        setErrorMsg('WebSocket connection error')
        setCallState('error')
      }

      ws.onclose = () => {
        if (callState === 'active') {
          setCallState('ended')
        }
      }

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return
        if (ws.readyState !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const int16arr = new Int16Array(input.length)
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]))
          int16arr[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        const bytes = new Uint8Array(int16arr.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)
        ws.send(JSON.stringify({ type: 'audio', audio: base64, sampleRate: sr }))
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start call')
      setCallState('error')
    }
  }, [])

  const endCall = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    nextPlayTimeRef.current = 0
    setCallState('ended')
  }, [])

  const handleClose = useCallback(() => {
    endCall()
    setCallState('idle')
    setTranscript([])
    setCallDuration(0)
    setErrorMsg('')
    setThinkingText('')
    onClose()
  }, [endCall, onClose])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Test Voice Call</DialogTitle>
          <DialogDescription className="font-sans text-sm">Test the AI receptionist by having a live conversation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {callState === 'active' && <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />}
              {callState === 'connecting' && <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />}
              {callState === 'ended' && <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />}
              {callState === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-red-500" />}
              {callState === 'idle' && <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />}
              <span className="text-sm font-sans text-muted-foreground capitalize">
                {callState === 'idle' ? 'Ready' : callState === 'active' ? 'In Call' : callState === 'connecting' ? 'Connecting...' : callState === 'error' ? 'Error' : 'Call Ended'}
              </span>
            </div>
            {(callState === 'active' || callState === 'ended') && (
              <span className="text-sm font-mono text-muted-foreground">{formatDuration(callDuration)}</span>
            )}
          </div>

          {/* Transcript */}
          <ScrollArea className="h-52 rounded-lg border bg-background p-3">
            {transcript.length === 0 && callState === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <FiPhoneCall className="w-8 h-8 mb-2 opacity-50" />
                <p>Click Start Call to begin</p>
              </div>
            )}
            {transcript.length === 0 && callState === 'connecting' && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <FiActivity className="w-8 h-8 mb-2 animate-pulse" />
                <p>Connecting to voice agent...</p>
              </div>
            )}
            <div className="space-y-2">
              {transcript.map((entry, i) => (
                <div key={i} className={cn('text-sm font-sans', entry.role === 'You' ? 'text-right' : 'text-left')}>
                  <span className="text-xs font-medium text-muted-foreground">{entry.role}</span>
                  <p className={cn('inline-block px-3 py-1.5 rounded-lg mt-0.5 max-w-[85%]', entry.role === 'You' ? 'bg-primary/10 text-foreground' : 'bg-secondary text-foreground')}>
                    {entry.text}
                  </p>
                </div>
              ))}
              {thinkingText && (
                <div className="text-left">
                  <span className="text-xs font-medium text-muted-foreground">Agent</span>
                  <p className="inline-block px-3 py-1.5 rounded-lg mt-0.5 bg-secondary text-muted-foreground italic text-sm">{thinkingText}</p>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>

          {errorMsg && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{errorMsg}</div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {callState === 'idle' || callState === 'ended' || callState === 'error' ? (
              <Button onClick={startCall} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <FiPhone className="w-4 h-4" />
                {callState === 'ended' ? 'Call Again' : 'Start Call'}
              </Button>
            ) : callState === 'active' ? (
              <>
                <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <FiMicOff className="w-5 h-5 text-destructive" /> : <FiMic className="w-5 h-5" />}
                </Button>
                <Button variant="destructive" size="icon" className="rounded-full w-12 h-12" onClick={endCall}>
                  <FiPhoneOff className="w-5 h-5" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Call Detail Modal ----
function CallDetailModal({ call, open, onClose }: { call: CallEntry | null; open: boolean; onClose: () => void }) {
  if (!call) return null
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Call Details</DialogTitle>
          <DialogDescription className="font-sans text-sm">{call.callerNumber} - {formatDateTime(call.timestamp)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={cn('border text-xs gap-1', getOutcomeBadgeClass(call.outcome))}>
              {getOutcomeIcon(call.outcome)}
              {getOutcomeLabel(call.outcome)}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1"><FiClock className="w-3.5 h-3.5" /> {call.duration}</span>
          </div>

          <div>
            <h4 className="text-sm font-semibold font-sans mb-1">Summary</h4>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">{call.summary}</p>
          </div>

          {call.appointmentDetails && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold font-sans mb-1 text-blue-800 flex items-center gap-1"><FiCalendar className="w-3.5 h-3.5" /> Appointment</h4>
              <p className="text-sm text-blue-700">{call.appointmentDetails}</p>
            </div>
          )}

          {call.faqMatched && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold font-sans mb-1 text-green-800 flex items-center gap-1"><FiHelpCircle className="w-3.5 h-3.5" /> FAQ Matched</h4>
              <p className="text-sm text-green-700">{call.faqMatched}</p>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="text-sm font-semibold font-sans mb-2">Transcript</h4>
            <ScrollArea className="h-48 rounded-lg border bg-background p-3">
              <div className="space-y-1.5">
                {call.transcript.split('\n').map((line, i) => {
                  if (line.startsWith('Agent:')) {
                    return <p key={i} className="text-sm font-sans"><span className="font-semibold text-primary">Agent:</span> {line.slice(6).trim()}</p>
                  }
                  if (line.startsWith('Caller:')) {
                    return <p key={i} className="text-sm font-sans"><span className="font-semibold text-accent-foreground">Caller:</span> {line.slice(7).trim()}</p>
                  }
                  return <p key={i} className="text-sm font-sans text-muted-foreground italic">{line}</p>
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Dashboard Screen ----
function DashboardScreen({ calls, onViewAllCalls, onManageKB, onTestCall }: { calls: CallEntry[]; onViewAllCalls: () => void; onManageKB: () => void; onTestCall: () => void }) {
  const [showSample, setShowSample] = useState(true)

  const metrics = useMemo(() => {
    if (!showSample) return { total: 0, appointments: 0, faqs: 0, transfers: 0 }
    return { total: 47, appointments: 12, faqs: 28, transfers: 7 }
  }, [showSample])

  const recentCalls = useMemo(() => {
    return showSample ? calls : []
  }, [showSample, calls])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-wide text-foreground">Dashboard</h1>
          <p className="text-sm font-sans text-muted-foreground mt-1">Today&#39;s performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="sample-toggle" className="text-xs font-sans text-muted-foreground">Sample Data</Label>
          <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<FiPhone className="w-5 h-5" />} label="Total Calls Today" value={metrics.total} change="+12%" changePositive={true} />
        <MetricCard icon={<FiCalendar className="w-5 h-5" />} label="Appointments Booked" value={metrics.appointments} change="+8%" changePositive={true} />
        <MetricCard icon={<FiHelpCircle className="w-5 h-5" />} label="FAQs Answered" value={metrics.faqs} change="+15%" changePositive={true} />
        <MetricCard icon={<FiUsers className="w-5 h-5" />} label="Transfers to Human" value={metrics.transfers} change="-5%" changePositive={false} />
      </div>

      {/* Recent Calls */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Recent Calls</CardTitle>
            <Button variant="outline" size="sm" onClick={onTestCall} className="gap-2 text-xs">
              <FiPhoneCall className="w-3.5 h-3.5" />
              Test Call
            </Button>
          </div>
          <CardDescription className="font-sans text-xs">Latest interactions handled by your AI receptionist</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FiPhoneIncoming className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-sans font-medium">No calls yet today</p>
              <p className="text-xs font-sans mt-1">Your AI receptionist is standing by</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {recentCalls.map((call) => (
                  <CallTimelineItem key={call.id} call={call} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={onViewAllCalls} className="gap-2 font-sans text-sm">
          <FiList className="w-4 h-4" />
          View All Calls
        </Button>
        <Button variant="outline" onClick={onManageKB} className="gap-2 font-sans text-sm">
          <FiDatabase className="w-4 h-4" />
          Manage Knowledge Base
        </Button>
      </div>
    </div>
  )
}

// ---- Call Timeline Item ----
function CallTimelineItem({ call }: { call: CallEntry }) {
  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setDetailOpen(true)}
        className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/60 transition-colors text-left group"
      >
        <div className="flex-shrink-0 p-2 rounded-full bg-secondary">
          {getOutcomeIcon(call.outcome)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-sans font-medium text-foreground">{call.callerNumber}</span>
            <Badge variant="outline" className={cn('text-[10px] border px-1.5 py-0', getOutcomeBadgeClass(call.outcome))}>
              {getOutcomeLabel(call.outcome)}
            </Badge>
          </div>
          <p className="text-xs font-sans text-muted-foreground mt-0.5 truncate">{call.summary}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-sans text-muted-foreground">{formatTime(call.timestamp)}</p>
          <p className="text-xs font-sans text-muted-foreground flex items-center gap-1 justify-end"><FiClock className="w-3 h-3" />{call.duration}</p>
        </div>
        <FiChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <CallDetailModal call={call} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  )
}

// ---- Call Log Screen ----
function CallLogScreen({ calls }: { calls: CallEntry[] }) {
  const [showSample, setShowSample] = useState(true)
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCall, setSelectedCall] = useState<CallEntry | null>(null)

  const filteredCalls = useMemo(() => {
    if (!showSample) return []
    let filtered = [...calls]
    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(c => c.outcome === outcomeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(c => c.callerNumber.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q))
    }
    return filtered
  }, [showSample, calls, outcomeFilter, searchQuery])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-wide text-foreground">Call Log</h1>
          <p className="text-sm font-sans text-muted-foreground mt-1">Complete history of all incoming calls</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="sample-toggle-cl" className="text-xs font-sans text-muted-foreground">Sample Data</Label>
          <Switch id="sample-toggle-cl" checked={showSample} onCheckedChange={setShowSample} />
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">Outcome</Label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-44 text-sm">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="faq">FAQ Answered</SelectItem>
                  <SelectItem value="appointment">Appointment Booked</SelectItem>
                  <SelectItem value="transfer">Transferred</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs font-sans text-muted-foreground">Search</Label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by caller number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FiSearch className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-sans font-medium">No calls found</p>
              <p className="text-xs font-sans mt-1">{showSample ? 'Try adjusting your filters' : 'Enable sample data to view demo call records'}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-sans text-xs">Date / Time</TableHead>
                    <TableHead className="font-sans text-xs">Caller Number</TableHead>
                    <TableHead className="font-sans text-xs">Duration</TableHead>
                    <TableHead className="font-sans text-xs">Outcome</TableHead>
                    <TableHead className="font-sans text-xs">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow key={call.id} className="cursor-pointer hover:bg-secondary/40 transition-colors" onClick={() => setSelectedCall(call)}>
                      <TableCell className="text-sm font-sans whitespace-nowrap">{formatDateTime(call.timestamp)}</TableCell>
                      <TableCell className="text-sm font-sans font-medium">{call.callerNumber}</TableCell>
                      <TableCell className="text-sm font-sans text-muted-foreground">{call.duration}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px] border gap-1', getOutcomeBadgeClass(call.outcome))}>
                          {getOutcomeIcon(call.outcome)}
                          {getOutcomeLabel(call.outcome)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-sans text-muted-foreground max-w-[250px] truncate">{call.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <CallDetailModal call={selectedCall} open={selectedCall !== null} onClose={() => setSelectedCall(null)} />
    </div>
  )
}

// ---- Knowledge Base Screen ----
function KnowledgeBaseScreen() {
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [crawlStatus, setCrawlStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawlLoading(true)
    setCrawlStatus(null)
    try {
      const result = await crawlWebsite(RAG_ID, crawlUrl.trim())
      if (result.success) {
        setCrawlStatus({ type: 'success', message: result.message ?? 'Website crawled and added successfully.' })
        setCrawlUrl('')
      } else {
        setCrawlStatus({ type: 'error', message: result.error ?? 'Failed to crawl website.' })
      }
    } catch {
      setCrawlStatus({ type: 'error', message: 'An error occurred while crawling.' })
    }
    setCrawlLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-wide text-foreground">Knowledge Base</h1>
        <p className="text-sm font-sans text-muted-foreground mt-1">Manage documents and data sources for your AI receptionist</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Documents */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <FiDatabase className="w-4 h-4 text-primary" />
              Upload Documents
            </CardTitle>
            <CardDescription className="font-sans text-xs">Add PDF, DOCX, or TXT files to train the receptionist</CardDescription>
          </CardHeader>
          <CardContent>
            <KnowledgeBaseUpload ragId={RAG_ID} />
          </CardContent>
        </Card>

        {/* Crawl Website */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <FiGlobe className="w-4 h-4 text-primary" />
              Add Website URL
            </CardTitle>
            <CardDescription className="font-sans text-xs">Crawl a website to extract content for the knowledge base</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crawl-url" className="text-sm font-sans">Website URL</Label>
              <Input
                id="crawl-url"
                type="url"
                placeholder="https://www.example.com/faq"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleCrawl} disabled={crawlLoading || !crawlUrl.trim()} className="w-full gap-2 font-sans text-sm">
              {crawlLoading ? (
                <>
                  <FiActivity className="w-4 h-4 animate-spin" />
                  Crawling...
                </>
              ) : (
                <>
                  <FiGlobe className="w-4 h-4" />
                  Crawl Website
                </>
              )}
            </Button>

            {crawlStatus && (
              <div className={cn('rounded-md p-3 text-sm font-sans', crawlStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive')}>
                <div className="flex items-center gap-2">
                  {crawlStatus.type === 'success' ? <FiCheckCircle className="w-4 h-4 flex-shrink-0" /> : <FiAlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {crawlStatus.message}
                </div>
              </div>
            )}

            <div className="text-xs font-sans text-muted-foreground space-y-1 pt-2">
              <p>Provide a URL and we will extract its content for the AI receptionist to reference when answering patient inquiries.</p>
              <p>Ideal for practice websites, FAQ pages, and service descriptions.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- Settings Screen ----
function SettingsScreen() {
  const [greeting, setGreeting] = useState('')
  const [transferRules, setTransferRules] = useState<TransferRule[]>([])
  const [newRule, setNewRule] = useState('')
  const [appointmentDuration, setAppointmentDuration] = useState('30')
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([])
  const [practiceInfo, setPracticeInfo] = useState<PracticeInfo>({ name: '', address: '', phone: '', insuranceList: '' })
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('medconnect_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setGreeting(parsed.greeting ?? 'Thank you for calling MedConnect. How can I help you today?')
        setTransferRules(Array.isArray(parsed.transferRules) ? parsed.transferRules : DEFAULT_TRANSFER_RULES)
        setAppointmentDuration(parsed.appointmentDuration ?? '30')
        setBusinessHours(Array.isArray(parsed.businessHours) ? parsed.businessHours : DEFAULT_BUSINESS_HOURS)
        setPracticeInfo(parsed.practiceInfo ?? { name: 'MedConnect Family Practice', address: '1234 Health Avenue, Suite 200', phone: '(555) 100-2000', insuranceList: 'Blue Cross Blue Shield, Aetna, Cigna, United Healthcare, Medicare' })
      } else {
        setGreeting('Thank you for calling MedConnect. How can I help you today?')
        setTransferRules(DEFAULT_TRANSFER_RULES)
        setBusinessHours(DEFAULT_BUSINESS_HOURS)
        setPracticeInfo({ name: 'MedConnect Family Practice', address: '1234 Health Avenue, Suite 200', phone: '(555) 100-2000', insuranceList: 'Blue Cross Blue Shield, Aetna, Cigna, United Healthcare, Medicare' })
      }
    } catch {
      setGreeting('Thank you for calling MedConnect. How can I help you today?')
      setTransferRules(DEFAULT_TRANSFER_RULES)
      setBusinessHours(DEFAULT_BUSINESS_HOURS)
      setPracticeInfo({ name: 'MedConnect Family Practice', address: '1234 Health Avenue, Suite 200', phone: '(555) 100-2000', insuranceList: 'Blue Cross Blue Shield, Aetna, Cigna, United Healthcare, Medicare' })
    }
  }, [])

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('medconnect_settings', JSON.stringify({
        greeting, transferRules, appointmentDuration, businessHours, practiceInfo
      }))
      setSaveStatus('Settings saved successfully.')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch {
      setSaveStatus('Failed to save settings.')
    }
  }, [greeting, transferRules, appointmentDuration, businessHours, practiceInfo])

  const addTransferRule = () => {
    if (!newRule.trim()) return
    setTransferRules(prev => [...prev, { id: Date.now().toString(), keyword: newRule.trim() }])
    setNewRule('')
  }

  const removeTransferRule = (id: string) => {
    setTransferRules(prev => prev.filter(r => r.id !== id))
  }

  const updateBusinessHour = (index: number, field: keyof BusinessHour, value: string | boolean) => {
    setBusinessHours(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-wide text-foreground">Settings</h1>
          <p className="text-sm font-sans text-muted-foreground mt-1">Configure your AI receptionist behavior</p>
        </div>
        <Button onClick={saveSettings} className="gap-2 font-sans text-sm">
          <FiCheckCircle className="w-4 h-4" />
          Save All Settings
        </Button>
      </div>

      {saveStatus && (
        <div className={cn('rounded-md p-3 text-sm font-sans border', saveStatus.includes('success') ? 'bg-green-50 text-green-800 border-green-200' : 'bg-destructive/10 text-destructive border-destructive/20')}>
          <div className="flex items-center gap-2">
            {saveStatus.includes('success') ? <FiCheckCircle className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
            {saveStatus}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Greeting */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Greeting Message</CardTitle>
            <CardDescription className="font-sans text-xs">The opening line when a caller connects</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              className="font-sans text-sm resize-none"
              placeholder="Enter the greeting message..."
            />
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Calendar Integration</CardTitle>
            <CardDescription className="font-sans text-xs">Google Calendar connection status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 border border-green-200 gap-1">
                <FiCheckCircle className="w-3 h-3" />
                Connected
              </Badge>
              <span className="text-sm font-sans text-muted-foreground">Google Calendar</span>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-sans">Default Appointment Duration</Label>
              <Select value={appointmentDuration} onValueChange={setAppointmentDuration}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transfer Rules */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Transfer Rules</CardTitle>
            <CardDescription className="font-sans text-xs">Keywords that trigger transfer to a human agent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                placeholder="Add keyword..."
                className="text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') addTransferRule() }}
              />
              <Button variant="outline" size="sm" onClick={addTransferRule} className="gap-1 text-xs flex-shrink-0">
                <FiPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(transferRules) && transferRules.map((rule) => (
                <Badge key={rule.id} variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs font-sans">
                  {rule.keyword}
                  <button onClick={() => removeTransferRule(rule.id)} className="ml-0.5 hover:text-destructive transition-colors">
                    <FiX className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Practice Info */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Practice Information</CardTitle>
            <CardDescription className="font-sans text-xs">Details shared with callers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">Practice Name</Label>
              <Input value={practiceInfo.name} onChange={(e) => setPracticeInfo(prev => ({ ...prev, name: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">Address</Label>
              <Input value={practiceInfo.address} onChange={(e) => setPracticeInfo(prev => ({ ...prev, address: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">Phone</Label>
              <Input value={practiceInfo.phone} onChange={(e) => setPracticeInfo(prev => ({ ...prev, phone: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-sans text-muted-foreground">Accepted Insurance (comma-separated)</Label>
              <Textarea value={practiceInfo.insuranceList} onChange={(e) => setPracticeInfo(prev => ({ ...prev, insuranceList: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Business Hours</CardTitle>
            <CardDescription className="font-sans text-xs">Set the operating schedule for your practice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.isArray(businessHours) && businessHours.map((bh, idx) => (
                <div key={bh.day} className="flex items-center gap-3 py-2">
                  <div className="w-28 flex-shrink-0">
                    <span className="text-sm font-sans font-medium">{bh.day}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!bh.closed} onCheckedChange={(v) => updateBusinessHour(idx, 'closed', !v)} />
                    <span className="text-xs font-sans text-muted-foreground w-12">{bh.closed ? 'Closed' : 'Open'}</span>
                  </div>
                  {!bh.closed && (
                    <>
                      <Input type="time" value={bh.open} onChange={(e) => updateBusinessHour(idx, 'open', e.target.value)} className="w-32 text-sm" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={bh.close} onChange={(e) => updateBusinessHour(idx, 'close', e.target.value)} className="w-32 text-sm" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function Page() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [agentActive, setAgentActive] = useState(true)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: <FiHome className="w-4 h-4" /> },
    { id: 'calls', label: 'Call Log', icon: <FiList className="w-4 h-4" /> },
    { id: 'kb', label: 'Knowledge Base', icon: <FiDatabase className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
  ], [])

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground flex">
          {/* Sidebar */}
          <aside className={cn('flex-shrink-0 bg-card border-r border-border flex flex-col transition-all duration-300', sidebarCollapsed ? 'w-16' : 'w-64')}>
            {/* Logo */}
            <div className="p-4 border-b border-border/50">
              {sidebarCollapsed ? (
                <button onClick={() => setSidebarCollapsed(false)} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <FiActivity className="w-4 h-4 text-primary-foreground" />
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <FiActivity className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-sm font-serif font-bold tracking-wide text-foreground">MedConnect</h2>
                      <p className="text-[10px] font-sans text-muted-foreground">AI Receptionist</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map(item => (
                sidebarCollapsed ? (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveNav(item.id)}
                        className={cn('w-full flex items-center justify-center p-3 rounded-lg transition-all duration-200', activeNav === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-secondary')}
                      >
                        {item.icon}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>{item.label}</p></TooltipContent>
                  </Tooltip>
                ) : (
                  <SidebarNavItem key={item.id} icon={item.icon} label={item.label} active={activeNav === item.id} onClick={() => setActiveNav(item.id)} />
                )
              ))}
            </nav>

            {/* Agent Status */}
            <div className="p-4 border-t border-border/50">
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <div className={cn('w-3 h-3 rounded-full', agentActive ? 'bg-green-500' : 'bg-muted-foreground')} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{agentActive ? 'Agent Active' : 'Agent Inactive'}</p></TooltipContent>
                </Tooltip>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', agentActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground')} />
                      <span className="text-xs font-sans font-medium text-foreground">{agentActive ? 'Agent Active' : 'Agent Inactive'}</span>
                    </div>
                    <Switch checked={agentActive} onCheckedChange={setAgentActive} />
                  </div>
                  <div className="text-[10px] font-sans text-muted-foreground space-y-0.5">
                    <p className="flex items-center gap-1"><FiPhone className="w-3 h-3" /> Voice Receptionist</p>
                    <p className="truncate text-[9px]">ID: {VOICE_AGENT_ID}</p>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-6 lg:p-8">
              {activeNav === 'dashboard' && (
                <DashboardScreen
                  calls={DEMO_CALLS}
                  onViewAllCalls={() => setActiveNav('calls')}
                  onManageKB={() => setActiveNav('kb')}
                  onTestCall={() => setVoiceCallOpen(true)}
                />
              )}
              {activeNav === 'calls' && <CallLogScreen calls={DEMO_CALLS} />}
              {activeNav === 'kb' && <KnowledgeBaseScreen />}
              {activeNav === 'settings' && <SettingsScreen />}
            </div>
          </main>

          {/* Voice Call Modal */}
          <VoiceCallModal open={voiceCallOpen} onClose={() => setVoiceCallOpen(false)} />
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
