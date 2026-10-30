import path from 'node:path'

import { dataDirectory } from '@/infra/data-directory'

export const generationsDirectory = path.join(dataDirectory, 'generations')

export const getGenerationFolder = (
  generationId: number,
  directory = generationsDirectory
) => path.join(directory, String(generationId))
