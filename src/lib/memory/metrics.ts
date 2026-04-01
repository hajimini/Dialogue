/**
 * MemoryMetrics - 性能监控系统
 * 
 * 用于跟踪记忆操作（add, search, update, delete）的响应时间和性能指标
 */

/**
 * 性能统计数据
 */
export type MetricStats = {
  count: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

/**
 * 记忆性能监控类
 */
export class MemoryMetrics {
  private metrics: Map<string, number[]> = new Map();

  /**
   * 记录性能指标
   * @param name - 指标名称（如 'memory.add.duration'）
   * @param value - 指标值（毫秒）
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // 保留最近1000条记录
    if (values.length > 1000) {
      values.shift();
    }

    // 如果超过阈值，记录警告（慢查询：>2秒）
    if (value > 2000) {
      console.warn(`[MemoryMetrics] Slow operation ${name}: ${value}ms`);
    }
  }

  /**
   * 获取指定指标的统计信息
   * @param name - 指标名称
   * @returns 统计信息，如果指标不存在则返回null
   */
  getStats(name: string): MetricStats | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  /**
   * 获取所有指标的统计信息
   * @returns 所有指标的统计信息映射
   */
  getAllStats(): Record<string, MetricStats> {
    const result: Record<string, MetricStats> = {};

    for (const [name] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = stats;
      }
    }

    return result;
  }

  /**
   * 重置所有指标
   * 用于测试或清理历史数据
   */
  reset(): void {
    this.metrics.clear();
  }
}

/**
 * 全局单例memoryMetrics
 */
export const memoryMetrics = new MemoryMetrics();
