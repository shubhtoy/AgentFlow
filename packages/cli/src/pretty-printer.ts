/**
 * Pretty-Printer.
 */

import fs from 'fs'
import path from 'path'
import type { ParsedFile, ParsedNode, ParsedWorkflow, ParsedGraph } from '@agentflow/core/parser-core'
import { CANONICAL_CATEGORIES } from '@agentflow/core/taxonomy'
import matter from 'gray-matter'

export function serialize(file: ParsedFile): string {
  const fm = file.frontmatter || {}
  const body = file.content != null ? file.content : ''
  if (Object.keys(fm).length === 0) return body
  return matter.stringify(body, fm)
}

export function serializeNode(node: ParsedNode, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true })
  const files = [node.primaryFile, ...node.contextFiles]
  for (const file of files) {
    const filename = path.basename(file.filePath)
    fs.writeFileSync(path.join(targetDir, filename), serialize(file), 'utf-8')
  }
  if ((node as ParsedNode & { artifacts?: unknown[] }).artifacts?.length) {
    fs.mkdirSync(path.join(targetDir, 'output'), { recursive: true })
  }
}

function serializeSubWorkflow(wf: ParsedWorkflow, parentDir: string): void {
  if (wf.descriptorFile) {
    const descFilename = path.basename(wf.descriptorFile.filePath)
    fs.writeFileSync(path.join(parentDir, descFilename), serialize(wf.descriptorFile), 'utf-8')
  }
  for (const nodeId of Object.keys(wf.nodes || {})) {
    const node = wf.nodes[nodeId]
    const nodeDir = path.join(parentDir, nodeId)
    serializeNode(node, nodeDir)
    if ((node as ParsedNode & { subWorkflow?: ParsedWorkflow }).subWorkflow) {
      serializeSubWorkflow((node as ParsedNode & { subWorkflow: ParsedWorkflow }).subWorkflow, nodeDir)
    }
  }
}

export function serializeGraph(graph: ParsedGraph, rootDir: string): void {
  fs.mkdirSync(rootDir, { recursive: true })

  for (const cat of CANONICAL_CATEGORIES) {
    const resources = (graph as unknown as Record<string, Record<string, ParsedFile>>)[cat]
    if (!resources) continue
    for (const key of Object.keys(resources)) {
      const file = resources[key]
      if (!file?.filePath) continue
      const relPath = file.relativePath || path.join(cat, path.basename(file.filePath))
      const destPath = path.join(rootDir, relPath)
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.writeFileSync(destPath, serialize(file), 'utf-8')
    }
  }

  if (graph.descriptorFile?.filePath) {
    const relPath = graph.descriptorFile.relativePath || path.basename(graph.descriptorFile.filePath)
    const destPath = path.join(rootDir, relPath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, serialize(graph.descriptorFile), 'utf-8')
  }

  for (const wfId of Object.keys(graph.workflows || {})) {
    const wf = graph.workflows[wfId]
    const wfDir = path.join(rootDir, wfId)
    fs.mkdirSync(wfDir, { recursive: true })

    if (wf.descriptorFile) {
      const descFilename = path.basename(wf.descriptorFile.filePath)
      fs.writeFileSync(path.join(wfDir, descFilename), serialize(wf.descriptorFile), 'utf-8')
    }

    for (const nodeId of Object.keys(wf.nodes || {})) {
      const node = wf.nodes[nodeId]
      serializeNode(node, path.join(wfDir, nodeId))
      if ((node as ParsedNode & { subWorkflow?: ParsedWorkflow }).subWorkflow) {
        serializeSubWorkflow(
          (node as ParsedNode & { subWorkflow: ParsedWorkflow }).subWorkflow,
          path.join(wfDir, nodeId),
        )
      }
    }
  }
}
