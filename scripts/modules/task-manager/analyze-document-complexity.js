import chalk from 'chalk';
import boxen from 'boxen';
import readline from 'readline';
import path from 'path';
import fs from 'fs';

import { log, writeJSON, isSilentMode } from '../utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';
import { generateTextService } from '../ai-services-unified.js';
import { getDebugFlag, getProjectName } from '../config-manager.js';

/**
 * 生成文档复杂度分析的提示
 * @param {string} documentContent - 文档内容
 * @returns {string} 生成的提示
 */
function generateDocumentComplexityAnalysisPrompt(documentContent) {
    return `分析以下文档内容的复杂度(1-10分)并提供详细分析。给出文档涵盖的主要主题、技术要点和实现难度。

文档内容：
${documentContent}

只回复一个有效的JSON对象，符合以下格式：
{
  "complexityScore": <1-10的数字>,
  "mainTopics": ["<主题1>", "<主题2>", ...],
  "technicalRequirements": ["<技术需求1>", "<技术需求2>", ...],
  "implementationChallenges": ["<挑战1>", "<挑战2>", ...],
  "recommendedTaskCount": <推荐任务数量>,
  "reasoning": "<复杂度评分的理由>"
}

不要包含任何解释性文本、Markdown格式或代码块标记。`;
}

/**
 * 分析文档复杂度并生成评估报告
 * @param {Object} options 命令选项
 * @param {string} options.file - 文档文件路径
 * @param {string} options.output - 报告输出文件路径
 * @param {boolean} [options.research] - 是否使用research角色
 * @param {string} [options.projectRoot] - 项目根路径(MCP/env回退)
 * @param {Object} context - 上下文对象
 * @param {Object} [context.session] - MCP服务器会话对象(可选)
 * @param {Object} [context.mcpLog] - MCP日志对象(可选)
 * @param {function} [context.reportProgress] - 报告进度的函数(可选)
 * @returns {Object} 复杂度分析报告
 */
async function analyzeDocumentComplexity(options, context = {}) {
    const { session, mcpLog } = context;
    const documentPath = options.file;
    const outputPath = options.output || 'reports/document-complexity-report.json';
    const useResearch = options.research || false;
    const projectRoot = options.projectRoot;

    const outputFormat = mcpLog ? 'json' : 'text';

    const reportLog = (message, level = 'info') => {
        if (mcpLog) {
            mcpLog[level](message);
        } else if (!isSilentMode() && outputFormat === 'text') {
            log(level, message);
        }
    };

    if (outputFormat === 'text') {
        console.log(
            chalk.blue(
                `分析文档复杂度并生成评估报告...`
            )
        );
    }

    try {
        // 检查文件是否存在
        if (!fs.existsSync(documentPath)) {
            throw new Error(`文档文件不存在: ${documentPath}`);
        }

        reportLog(`读取文档内容: ${documentPath}...`, 'info');
        const documentContent = fs.readFileSync(documentPath, 'utf8');
        
        if (!documentContent || documentContent.trim().length === 0) {
            throw new Error('文档内容为空');
        }

        reportLog(`文档字符数: ${documentContent.length}`, 'info');

        const prompt = generateDocumentComplexityAnalysisPrompt(documentContent);
        const systemPrompt = '你是一个专业的文档分析助手，专门评估技术文档的复杂度和实现难度。请只回复请求的有效JSON对象。';

        let loadingIndicator = null;
        if (outputFormat === 'text') {
            loadingIndicator = startLoadingIndicator('调用AI服务...');
        }

        let fullResponse = '';

        try {
            const role = useResearch ? 'research' : 'main';
            reportLog(`使用AI服务角色: ${role}`, 'info');

            fullResponse = await generateTextService({
                prompt,
                systemPrompt,
                role,
                session,
                projectRoot
            });

            reportLog(
                '成功收到AI服务的文本响应',
                'success'
            );

            if (loadingIndicator) {
                stopLoadingIndicator(loadingIndicator);
                loadingIndicator = null;
            }

            if (outputFormat === 'text') {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.log(
                    chalk.green('AI服务调用完成。正在解析响应...')
                );
            }

            reportLog(`解析文档复杂度分析结果...`, 'info');
            let complexityAnalysis;
            try {
                let cleanedResponse = fullResponse.trim();

                const codeBlockMatch = cleanedResponse.match(
                    /```(?:json)?\s*([\s\S]*?)\s*```/
                );
                if (codeBlockMatch) {
                    cleanedResponse = codeBlockMatch[1].trim();
                    reportLog('从代码块中提取JSON', 'info');
                } else {
                    const firstBrace = cleanedResponse.indexOf('{');
                    const lastBrace = cleanedResponse.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        cleanedResponse = cleanedResponse.substring(
                            firstBrace,
                            lastBrace + 1
                        );
                        reportLog('提取内容在第一个{和最后一个}之间', 'info');
                    } else {
                        reportLog(
                            '警告：响应内容似乎不是有效的JSON对象。',
                            'warn'
                        );
                    }
                }

                try {
                    complexityAnalysis = JSON.parse(cleanedResponse);
                } catch (jsonError) {
                    reportLog(
                        '初始JSON解析失败。原始响应可能格式错误。',
                        'error'
                    );
                    reportLog(`原始JSON错误: ${jsonError.message}`, 'error');
                    if (outputFormat === 'text' && getDebugFlag(session)) {
                        console.log(chalk.red('--- 开始原始错误响应 ---'));
                        console.log(chalk.gray(fullResponse));
                        console.log(chalk.red('--- 结束原始错误响应 ---'));
                    }
                    throw new Error(
                        `无法解析JSON响应: ${jsonError.message}`
                    );
                }
            } catch (error) {
                if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
                reportLog(
                    `解析复杂度分析JSON时出错: ${error.message}`,
                    'error'
                );
                if (outputFormat === 'text') {
                    console.error(
                        chalk.red(
                            `解析复杂度分析JSON时出错: ${error.message}`
                        )
                    );
                }
                throw error;
            }

            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 创建最终报告
            const finalReport = {
                meta: {
                    generatedAt: new Date().toISOString(),
                    documentPath: documentPath,
                    projectName: getProjectName(session),
                    usedResearch: useResearch
                },
                analysis: complexityAnalysis
            };

            reportLog(`将复杂度报告写入 ${outputPath}...`, 'info');
            writeJSON(outputPath, finalReport);

            reportLog(
                `文档复杂度分析完成。报告已写入 ${outputPath}`,
                'success'
            );

            if (outputFormat === 'text') {
                console.log(
                    chalk.green(
                        `文档复杂度分析完成。报告已写入 ${outputPath}`
                    )
                );

                console.log('\n文档复杂度分析摘要:');
                console.log('--------------------');
                console.log(`复杂度评分: ${complexityAnalysis.complexityScore}/10`);
                console.log(`推荐任务数量: ${complexityAnalysis.recommendedTaskCount}`);
                console.log(`主要主题: ${complexityAnalysis.mainTopics.join(', ')}`);
                console.log(`技术要求: ${complexityAnalysis.technicalRequirements.join(', ')}`);
                console.log(`实现挑战: ${complexityAnalysis.implementationChallenges.join(', ')}`);
                console.log(`评估理由: ${complexityAnalysis.reasoning}`);
                console.log(`\n详细信息请查看报告文件: ${outputPath}`);

                console.log(
                    boxen(
                        chalk.white.bold('建议后续步骤:') +
                            '\n\n' +
                            `${chalk.cyan('1.')} 运行 ${chalk.yellow('task-master parse-prd --file=' + documentPath)} 将文档转化为任务\n` +
                            `${chalk.cyan('2.')} 运行 ${chalk.yellow('task-master list')} 查看生成的任务\n` +
                            `${chalk.cyan('3.')} 运行 ${chalk.yellow('task-master analyze-complexity')} 分析任务复杂度`,
                        {
                            padding: 1,
                            borderColor: 'cyan',
                            borderStyle: 'round',
                            margin: { top: 1 }
                        }
                    )
                );
            }

            return finalReport;
        } catch (error) {
            if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
            reportLog(`AI服务调用过程中出错: ${error.message}`, 'error');
            if (outputFormat === 'text') {
                console.error(
                    chalk.red(`AI服务调用过程中出错: ${error.message}`)
                );
                if (error.message.includes('API key')) {
                    console.log(
                        chalk.yellow(
                            '\n请确保您的API密钥在.env或~/.taskmaster/.env中正确配置'
                        )
                    );
                    console.log(
                        chalk.yellow("如需重新配置，请运行'task-master models --setup'")
                    );
                }
            }
            throw error;
        }
    } catch (error) {
        reportLog(`分析文档复杂度时出错: ${error.message}`, 'error');
        if (outputFormat === 'text') {
            console.error(
                chalk.red(`分析文档复杂度时出错: ${error.message}`)
            );
            if (getDebugFlag(session)) {
                console.error(error);
            }
            process.exit(1);
        } else {
            throw error;
        }
    }
}

export default analyzeDocumentComplexity;
