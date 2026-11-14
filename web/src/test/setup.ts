import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-cleans with Vitest globals, which we don't enable.
afterEach(cleanup)
