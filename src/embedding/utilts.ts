/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function cosineSimilarity(rowA: number[], rowB: number[]): number {
  const dotProduct = rowA.reduce((sum, a, j) => sum + a * rowB[j], 0);
  const magnitudeA = Math.sqrt(rowA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(rowB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error('Rows must not contain only zeros.');
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export function cosineSimilarityMatrix(matrixA: number[][], matrixB: number[][]): number[][] {
  if ((matrixA[0]?.length ?? 0) !== (matrixB[0]?.length ?? 0)) {
    throw new Error('Matrices must have the same number of columns.');
  }
  return matrixA.map((rowA) => matrixB.map((rowB) => cosineSimilarity(rowA, rowB)));
}
