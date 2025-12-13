import { join, parse, resolve } from 'path'
import { type TConfig, type TConfigAi } from './config'
import { GetLogger, Logger } from './logger'
import { fsReadDir } from './util/fsReadDir'
import { PromtLoad, type TPromt } from 'vv-ai-promt-store'
import { fsReadFile } from './util/fsReadFile'
import { Ai } from './ai'
import { fsWriteFile } from './util/fsWriteFile'
import { gethash } from './util/hash'

export async function Go(config: TConfig): Promise<void> {
	let getLogger: { error?: string; logger?: Logger } = { error: undefined, logger: undefined }
	try {
		getLogger = GetLogger('mentator-promter', config.log.dir, config.log.mode)
		if (getLogger.error) {
			console.error(`${getLogger.error}`)
			return
		}
		const logger = getLogger.logger!
		logger.debug('APP START')
		logger.debug(`model in config: ${config.ai.length}`)

		const fsReadDirPromtRes = await fsReadDir(resolve(config.prompt.dir))
		if (!fsReadDirPromtRes.ok) {
			logger.error(`on scan config.prompt.dir`, fsReadDirPromtRes.error)
			return
		}
		const promtFileList = fsReadDirPromtRes.result
		logger.debug(`in config.prompt.dir "${config.prompt.dir}" find files: ${promtFileList.length}`)

		if (config.prompt.payload) {
			const fsReadDirPayloadRes = await fsReadDir(config.prompt.payload.dir)
			if (!fsReadDirPayloadRes.ok) {
				logger.error(`on scan config.prompt.payload.dir`, fsReadDirPayloadRes.error)
				return
			}
			const payloadFileList = fsReadDirPayloadRes.result
			logger.debug(`in config.prompt.payload "${config.prompt.payload.dir}" find files: ${payloadFileList.length}`)

			for (let payloadIdx = 0; payloadIdx < payloadFileList.length; payloadIdx++) {
				const payloadFile = payloadFileList[payloadIdx]
				if (!payloadFile) continue
				logger.debug(
					`[${(payloadIdx + 1).toString().padStart(5, '0')}/${payloadFileList.length.toString().padStart(5, '0')}] process file "${payloadFile}"`,
				)

				const payloadFileFullName = join(config.prompt.payload.dir, payloadFile)
				const payloadFileRes = await fsReadFile(payloadFileFullName)
				if (!payloadFileRes.ok) {
					logger.error(`on read payload file "${payloadFileFullName}"`, payloadFileRes.error)
					continue
				}
				const p = parse(payloadFile)
				const answerDir = join(config.answer.dir, payloadFile)
				const hashFullFileName = join(answerDir, `${p.name}${p.ext}.hash.txt`)
				const currentHash = gethash(payloadFileRes.result)

				// Check if we should skip this file based on hash
				if (config.prompt.verify_hash) {
					const savedHashRes = await fsReadFile(hashFullFileName)
					if (savedHashRes.ok && currentHash === savedHashRes.result) {
						logger.debug(`     ignore file (hash not changed) "${payloadFile}"`)
						continue
					}
				}

				let hasErrors = false

				// Process all prompts for this payload file
				for (let promtFileIdx = 0; promtFileIdx < promtFileList.length; promtFileIdx++) {
					const promtFile = promtFileList[promtFileIdx]
					if (!promtFile) continue
					const promtFileFullName = join(config.prompt.dir, promtFile)
					const promtFileRes = await fsReadFile(promtFileFullName)
					if (!promtFileRes.ok) {
						logger.error(`on read promt file "${promtFileFullName}"`, promtFileRes.error)
						hasErrors = true
						continue
					}
					const promtList = PromtLoad(promtFileRes.result)
					for (let promtIdx = 0; promtIdx < promtList.length; promtIdx++) {
						const promt = promtList[promtIdx]
						if (!promt) continue

						const userText = promt.user.replaceAll(config.prompt.payload.replace, payloadFileRes.result)
						const answerFileName = `${p.name}${p.ext}.answer-${promtFileIdx}-${promtIdx}-{aiIdx}.txt`

						const processResult = await processPromt({ user: userText, system: promt.system }, config.ai, answerDir, answerFileName, logger)
						if (!processResult) {
							hasErrors = true
						}
					}
				}

				// Save hash only if all prompts were processed successfully
				if (!hasErrors) {
					const saveHashRes = await fsWriteFile(hashFullFileName, currentHash)
					if (!saveHashRes.ok) {
						logger.error(`on save hash for file "${payloadFileFullName}"`, saveHashRes.error)
					}
				}
			}
		} else {
			for (let promtFileIdx = 0; promtFileIdx < promtFileList.length; promtFileIdx++) {
				const promtFile = promtFileList[promtFileIdx]
				if (!promtFile) continue
				logger.debug(
					`[${(promtFileIdx + 1).toString().padStart(5, '0')}/${promtFileList.length.toString().padStart(5, '0')}] process file "${promtFile}"`,
				)
				const promtFileFullName = join(config.prompt.dir, promtFile)
				const promtFileRes = await fsReadFile(promtFileFullName)
				if (!promtFileRes.ok) {
					logger.error(`on read promt file "${promtFileFullName}"`, promtFileRes.error)
					continue
				}
				const p = parse(promtFile)
				const answerDir = join(config.answer.dir, promtFile)
				const hashFullFileName = join(answerDir, `${p.name}${p.ext}.hash.txt`)
				const currentHash = gethash(promtFileRes.result)

				// Check if we should skip this file based on hash
				if (config.prompt.verify_hash) {
					const savedHashRes = await fsReadFile(hashFullFileName)
					if (savedHashRes.ok && currentHash === savedHashRes.result) {
						logger.debug(`     ignore file (hash not changed) "${promtFile}"`)
						continue
					}
				}

				let hasErrors = false

				const promtList = PromtLoad(promtFileRes.result)
				for (let promtIdx = 0; promtIdx < promtList.length; promtIdx++) {
					const promt = promtList[promtIdx]
					if (!promt) continue

					const answerFileName = `${p.name}${p.ext}.answer-${promtIdx}-{aiIdx}.txt`

					const processResult = await processPromt(promt, config.ai, answerDir, answerFileName, logger)
					if (!processResult) {
						hasErrors = true
					}
				}

				// Save hash only if all prompts were processed successfully
				if (!hasErrors) {
					const saveHashRes = await fsWriteFile(hashFullFileName, currentHash)
					if (!saveHashRes.ok) {
						logger.error(`on save hash for file "${promtFileFullName}"`, saveHashRes.error)
					}
				}
			}
		}
	} catch (error) {
		if (getLogger.logger) {
			getLogger.logger.error(`${error}`)
		} else {
			console.error(`${error}`)
		}
	} finally {
		if (getLogger.logger) {
			getLogger.logger.debug('APP STOP')
			getLogger.logger.close(() => {
				process.exit()
			})
		}
	}
}

async function processPromt(promt: TPromt, aiConfigs: TConfigAi[], answerDir: string, answerFileName: string, logger: Logger): Promise<boolean> {
	let hasErrors = false
	for (let aiIdx = 0; aiIdx < aiConfigs.length; aiIdx++) {
		const ai = aiConfigs[aiIdx]
		if (!ai) continue
		const resAi = await Ai(ai, { user: promt.user, system: promt.system })
		if (!resAi.ok) {
			logger.error(`on promt to ai #${aiIdx}`, resAi.error)
			hasErrors = true
			continue
		}
		const answerFullFileName = join(answerDir, answerFileName.replace('{aiIdx}', `${aiIdx}`))
		const fsWriteFileRes = await fsWriteFile(answerFullFileName, resAi.result)
		if (!fsWriteFileRes.ok) {
			logger.error(`on write answer:`, fsWriteFileRes.error)
			hasErrors = true
			continue
		}
	}
	return !hasErrors
}
