import path from 'node:path'

import { dataDirectory } from '@/infra/data-directory'

export const photosDirectory = path.join(dataDirectory, 'photos')
