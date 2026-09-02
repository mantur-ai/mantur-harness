process.once('SIGTERM', () => {
  setTimeout(() => { process.exit(0) }, 25)
})

if (process.env.DESKTOP_TEST_SKIP_READY !== '1') {
  console.log('dsh web: http://127.0.0.1:4312/?token=desktop-test')
}
console.error('desktop runtime stderr')

setInterval(() => {}, 1_000)
