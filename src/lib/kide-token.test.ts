import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  KIDE_TOKEN_COPY_COMMAND,
  normalisePastedKideToken,
  TELEGRAM_BOT_URL,
} from './kide-token'

test('normalisePastedKideToken removes Kide localStorage warning text', () => {
  const raw = '"WARNING: do not paste this anywhere! abc.def.ghi"'

  assert.equal(normalisePastedKideToken(raw), 'abc.def.ghi')
})

test('normalisePastedKideToken keeps a plain token unchanged apart from whitespace', () => {
  assert.equal(normalisePastedKideToken('  abc.def.ghi  '), 'abc.def.ghi')
})

test('KIDE_TOKEN_COPY_COMMAND copies the Kide authorization token from localStorage', () => {
  assert.equal(KIDE_TOKEN_COPY_COMMAND, "copy(localStorage.getItem('authorization.token'))")
})

test('TELEGRAM_BOT_URL opens Tarppibot directly', () => {
  assert.equal(TELEGRAM_BOT_URL, 'https://t.me/Tarppibot')
})
