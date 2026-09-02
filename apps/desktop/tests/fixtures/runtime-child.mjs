console.log('dsh web: http://127.0.0.1:4312/?token=desktop-test')
console.error('desktop runtime stderr')

process.once('SIGTERM', () => {
  setTimeout(() => { process.exit(0) }, 25)
})

setInterval(() => {}, 1_000)
