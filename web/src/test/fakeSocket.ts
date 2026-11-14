import type { ClientMsg, ServerMsg } from '../types'

// Minimal stand-in for the browser WebSocket: tests drive open/message/close by hand.
export class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static all: FakeSocket[] = []

  readyState = FakeSocket.CONNECTING
  sent: ClientMsg[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null

  constructor(public url: string) {
    FakeSocket.all.push(this)
  }

  static get last() {
    return FakeSocket.all[FakeSocket.all.length - 1]
  }

  send(data: string) {
    if (this.readyState !== FakeSocket.OPEN) throw new Error('InvalidStateError')
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.readyState = FakeSocket.CLOSED
  }

  serverOpen() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }

  serverSend(msg: ServerMsg) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }

  serverClose(code = 1006) {
    this.readyState = FakeSocket.CLOSED
    this.onclose?.({ code })
  }
}
