import 'server-only'

import { redirect } from 'next/navigation'

import { database } from '@/infra/database/client'
import { brandModel } from '@/models/brand/model'

// A new instance has no brand yet, so every page that needs it starts the guided first setup
export const requireBrandSettings = () =>
  brandModel.findSettings(database) ?? redirect('/')
