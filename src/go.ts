import { join } from 'path'
import { promptTemplateRead, type TConfig } from './config'
import { GetLogger, Logger } from './logger'
import { fsReadDirSync } from './util/fsReadDir'
import { type TPrompt } from 'vv-ai-prompt-format'
import { fsReadFileSync } from './util/fsReadFile'
import { fsWriteFileSync } from './util/fsWriteFile'
import { gethash } from './util/hash'
import { Ai } from './ai'
import { dualReplace } from './util/dualReplace'
import { isEmptyObj } from './util/isEmptyObj'

export async function Go(config: TConfig): Promise<void> {
	let getLogger: { error?: string; logger?: Logger } = { error: undefined, logger: undefined }
	try {
		getLogger = GetLogger('mentator-llm-prompter', config.log.dir, config.log.mode)
		if (getLogger.error) {
			console.error(`${getLogger.error}`)
			return
		}
		const logger = getLogger.logger!
		logger.debug('APP START')
		logger.debug(`model in config: "${config.ai.model}"`)

		const payloadReadDirRes = fsReadDirSync(config.prompt.dir)
		if (!payloadReadDirRes.ok) {
			logger.error(`on read payload dir: ${payloadReadDirRes.error}`)
			return
		}

		const promptTemplateReadRes = promptTemplateRead(config)
		if (!promptTemplateReadRes.ok) {
			logger.error(promptTemplateReadRes.error)
			return
		}
		let printPromptMode = false

		for (const payloadFileName of payloadReadDirRes.result) {
			const payloadRes = fsReadFileSync(join(config.prompt.dir, payloadFileName))
			if (!payloadRes.ok) {
				logger.error(`on read text from payload file: ${payloadRes.error}`)
				continue
			}
			if (!payloadRes.result) {
				logger.error(`empty data, skip payload file "${payloadFileName}"`)
				continue
			}
			const hash = gethash(payloadRes.result)
			if (config.answer.hashDir) {
				const readCurrentHashRes = fsReadFileSync(join(config.answer.hashDir, `${payloadFileName}.hash`))
				if (!readCurrentHashRes.ok) {
					logger.error(`on read current hash: ${readCurrentHashRes.error}`)
					continue
				}
				if (hash === readCurrentHashRes.result) {
					logger.debug(`hash not changed, ignore "${payloadFileName}"`)
					continue
				}
			}
			if (promptTemplateReadRes.result.jsonPipe) {
				if (!printPromptMode) {
					logger.debug(`prompt mode - "json pipe"`)
					printPromptMode = true
				}
				let resultJson = {} as object
				let hasError = false
				const uniqIdxFile = Array.from(new Set(promptTemplateReadRes.result.list.map(m => m.idxFile)))
				for (const idxFile of uniqIdxFile) {
					for (const templateItem of promptTemplateReadRes.result.list.filter(f => f.idxFile === idxFile)) {
						const prompt = {
							...templateItem.prompt,
							system: dualReplace(
								templateItem.prompt.system,
								{ find: config.prompt.templateReplacePayload, replace: payloadRes.result },
								{ find: config.prompt.templateReplaceJson, replace: JSON.stringify(resultJson, null, 4) },
							),
							user: dualReplace(
								templateItem.prompt.user,
								{ find: config.prompt.templateReplacePayload, replace: payloadRes.result },
								{ find: config.prompt.templateReplaceJson, replace: JSON.stringify(resultJson, null, 4) },
							) || '',
						}
						const aiRes = await Ai(config.ai, prompt)
						if (!aiRes.ok) {
							logger.error(`on get answer (template ${templateItem.idxFile}:${templateItem.idxInFile}) for "${payloadFileName}": ${aiRes.error}`)
							hasError = true
							break
						}
						try {
							resultJson = JSON.parse(aiRes.result)
						} catch(err) {
							logger.error(`on convert (template ${templateItem.idxFile}:${templateItem.idxInFile}) answer to JSON: ${err}`, aiRes.result)
							hasError = true
							break
						}

						if (!isEmptyObj(resultJson)) {
							break
						}
					}
					if (hasError) break
				}

				const writeAnswerRes = fsWriteFileSync(join(config.answer.dir, payloadFileName), JSON.stringify(resultJson, null, 4))
				if (!writeAnswerRes.ok) {
					logger.error(`on save answer for "${payloadFileName}": ${writeAnswerRes.error}`)
					continue
				}
				if (!hasError) {
					logger.debug(`answer saved for "${payloadFileName}"`)
				}
			} else if (promptTemplateReadRes.result.list.length > 0) {
				if (!printPromptMode) {
					logger.debug(`prompt mode - "template"`)
					printPromptMode = true
				}
				let hasError = false
				for (const templateItem of promptTemplateReadRes.result.list) {
					const prompt = {
						...templateItem.prompt,
						system:
							templateItem.prompt.system && config.prompt.templateReplacePayload
								? templateItem.prompt.system.replaceAll(config.prompt.templateReplacePayload, payloadRes.result)
								: templateItem.prompt.system,
						user:
							templateItem.prompt.user && config.prompt.templateReplacePayload
								? templateItem.prompt.user.replaceAll(config.prompt.templateReplacePayload, payloadRes.result)
								: templateItem.prompt.user,
					}
					const aiRes = await Ai(config.ai, prompt)
					if (!aiRes.ok) {
						logger.error(`on get answer (template ${templateItem.idxFile}:${templateItem.idxInFile}) for "${payloadFileName}": ${aiRes.error}`)
						hasError = true
						continue
					}
					const writeAnswerRes = fsWriteFileSync(
						join(
							config.answer.dir,
							payloadFileName,
							`answer-${templateItem.idxFile.toString().padStart(3, '0')}-${templateItem.idxInFile.toString().padStart(3, '0')}.txt`,
						),
						aiRes.result,
					)
					if (!writeAnswerRes.ok) {
						logger.error(
							`on save answer (template ${templateItem.idxFile}:${templateItem.idxInFile}) for "${payloadFileName}": ${writeAnswerRes.error}`,
						)
						hasError = true
						continue
					}
				}
				if (!hasError) {
					logger.debug(`answer(s) saved for "${payloadFileName}"`)
				}
			} else {
				if (!printPromptMode) {
					logger.debug(`prompt mode - "basic"`)
					printPromptMode = true
				}
				const prompt: TPrompt = {
					user: payloadRes.result,
				}

				const aiRes = await Ai(config.ai, prompt)
				if (!aiRes.ok) {
					logger.error(`on get answer for "${payloadFileName}": ${aiRes.error}`)
					continue
				}
				const writeAnswerRes = fsWriteFileSync(join(config.answer.dir, payloadFileName), aiRes.result)
				if (!writeAnswerRes.ok) {
					logger.error(`on save answer for "${payloadFileName}": ${writeAnswerRes.error}`)
					continue
				}
				logger.debug(`answer saved for "${payloadFileName}"`)
			}

			if (config.answer.hashDir) {
				const writeCurrentHashRes = fsWriteFileSync(join(config.answer.hashDir, `${payloadFileName}.hash`), hash)
				if (!writeCurrentHashRes.ok) {
					logger.error(`on write new hash: ${writeCurrentHashRes.error}`)
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
