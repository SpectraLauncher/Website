spectra.commands.register('show-name', async ({ instanceId }) => {
  const instance = await spectra.instances.get(instanceId)
  await spectra.ui.toast(instance.name, { description: `Minecraft ${instance.mcVersion}` })
})

spectra.events.on('game:exit', async ({ instanceId }) => {
  if ((await spectra.storage.get('toastOnExit')) === false) return
  const instance = await spectra.instances.get(instanceId)
  await spectra.ui.toast(`${instance.name} closed`, { color: 'info' })
})
