// You have this (basic):
try {
  await api.call()
} catch (error) {
  Alert.alert('Error', 'Something went wrong')
}

// You need this (medical-grade):
try {
  await api.call()
} catch (error) {
  if (error.code === 'CRITICAL_MED_ERROR') {
    await this.handleCriticalError(error)
    await this.notifyProvider(error)
    await this.auditLog.logError(error)
  }
  // Graceful degradation, not just alerts
}