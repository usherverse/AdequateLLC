const { createClient } = require('@supabase/supabase-js')

const oldSupabase = createClient(
  'https://fbcnupdppyihgxbpsxvu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiY251cGRwcHlpaGd4YnBzeHZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxODg1NSwiZXhwIjoyMDg5NTk0ODU1fQ.m6n_wC52asuq-Uuq02qtzhTBJbIIQ_OZQtN-eYdN8PA'
)

const newSupabase = createClient(
  'https://bgcnenjnrnicsmnyvqhq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NzQ0MCwiZXhwIjoyMDkwOTczNDQwfQ.v7Gw8Sfx81NdFxaW-QBS0O7iOcaFql5j4hW0De2bKJE'
)

const BUCKET = 'documents'

async function listAllFiles(prefix = '') {
  const { data, error } = await oldSupabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0
  })

  if (error) {
    console.error('Error listing:', error)
    return []
  }

  let allFiles = []

  for (const item of data) {
    if (item.id === null) {
      // it's a folder, recurse into it
      const subFiles = await listAllFiles(prefix ? `${prefix}/${item.name}` : item.name)
      allFiles = allFiles.concat(subFiles)
    } else {
      // it's a file
      allFiles.push(prefix ? `${prefix}/${item.name}` : item.name)
    }
  }

  return allFiles
}

async function migrateStorage() {
  console.log('Starting storage migration...')

  const allFiles = await listAllFiles()
  console.log(`Found ${allFiles.length} files to migrate`)

  for (const filePath of allFiles) {
    try {
      console.log(`Copying: ${filePath}`)

      const { data: fileData, error: downloadError } = await oldSupabase.storage
        .from(BUCKET)
        .download(filePath)

      if (downloadError) {
        console.error(`Failed to download ${filePath}:`, downloadError)
        continue
      }

      const { error: uploadError } = await newSupabase.storage
        .from(BUCKET)
        .upload(filePath, fileData, { upsert: true })

      if (uploadError) {
        console.error(`Failed to upload ${filePath}:`, uploadError)
        continue
      }

      console.log(`✓ Copied: ${filePath}`)
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err)
    }
  }

  console.log('Done!')
}

migrateStorage()