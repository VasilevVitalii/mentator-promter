import { join, parse, resolve } from 'path'
import { TemplateRead, type TConfig, type TConfigAi } from './config'
import { GetLogger, Logger } from './logger'
import { fsReadDir } from './util/fsReadDir'
import { PromtLoad, type TPromt, CheckJsonSchema, ConvertJsonSchemaToGbnf } from 'vv-ai-promt-store'
import { fsReadFile, fsReadFileSync } from './util/fsReadFile'
import { Ai } from './ai'
import { fsWriteFileSync } from './util/fsWriteFile'
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
		logger.debug(`model in config: "${config.ai.model}"`)

		const templateReadRes = TemplateRead(config.prompt.template.file)
		if (!templateReadRes.ok) {
			logger.error(templateReadRes.error)
			return
		}
		if (templateReadRes.result.jsonresponse) {
			if (config.ai.kind === 'openapi' || config.ai.kind === 'ollama' || config.ai.kind === 'mentator') {
				const errorJsonSchema = CheckJsonSchema(templateReadRes.result.jsonresponse)
				if (errorJsonSchema) {
					logger.error(`on check json schema from "${config.prompt.template.file}": `, errorJsonSchema)
					return
				}
				if (config.ai.kind === 'mentator') {
					const resultGbnf = ConvertJsonSchemaToGbnf(JSON.parse(templateReadRes.result.jsonresponse))
					if ('error' in resultGbnf) {
						logger.error(`on ckeck GBNF format from "${config.prompt.template.file}": `, resultGbnf.error)
						return
					}
				}
			}
		}
		logger.debug(`load template from "${config.prompt.template.file}"`)

		const fsReadDirPromtRes = await fsReadDir(resolve(config.prompt.dir))
		if (!fsReadDirPromtRes.ok) {
			logger.error(`on scan config.prompt.dir`, fsReadDirPromtRes.error)
			return
		}
		logger.debug(`in config.prompt.dir "${config.prompt.dir}" find file(s): ${fsReadDirPromtRes.result.length}`)

		for (const promtFile of fsReadDirPromtRes.result) {
			const promtFullFile = join(config.prompt.dir, promtFile)
			const readFileRes = fsReadFileSync(promtFullFile)
			if (!readFileRes.ok) {
				logger.error(`on read promt file: ${readFileRes.error}`)
				continue
			}
			const readHashFile = gethash(readFileRes.result)

			if (config.answer.hashDir) {
				const hashFullFile = join(config.answer.hashDir, `${promtFile}.hash`)
				const readHashRes = fsReadFileSync(hashFullFile)
				if (!readHashRes.ok) {
					logger.error(`on read hash file: ${readHashRes.error}`)
					continue
				}
				if (readHashRes.result === readHashFile) {
					logger.debug(`hash not changed, skip file ${promtFile}`)
					continue
				}
			}

			const endpointPromt = { ...templateReadRes.result }
			endpointPromt.user = endpointPromt.user.replaceAll(config.prompt.template.replace, readFileRes.result)
			if (endpointPromt.system) {
				endpointPromt.system = endpointPromt.system.replaceAll(config.prompt.template.replace, readFileRes.result)
			}

			const aiRes = await Ai(config.ai, endpointPromt, templateReadRes.result.jsonresponse)
			if (!aiRes.ok) {
				logger.error(`on get answer for "${promtFile}": ${aiRes.error}`)
				continue
			}

			const answerFullFile = join(config.answer.dir, `${promtFile}.txt`)
			const saveAnswerFileRes = fsWriteFileSync(answerFullFile, aiRes.result)
			if (!saveAnswerFileRes.ok) {
				logger.error(`on save answer: ${saveAnswerFileRes.error}`)
				continue
			}

			if (config.answer.hashDir) {
				const hashFullFile = join(config.answer.hashDir, `${promtFile}.hash`)
				const saveHashRes = fsWriteFileSync(hashFullFile, readHashFile)
				if (!saveHashRes.ok) {
					logger.error(`on save hash: ${saveHashRes.error}`)
					continue
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