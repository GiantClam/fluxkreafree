import { env } from "@/env.mjs";
import { S3Service } from "@/lib/s3";
import axios from "axios";
import FormData from "form-data";

/**
 * RunningHub API 封装
 * 专门用于 clothing-tryon 工作流
 */

export interface RunningHubUploadResponse {
  code: number;
  msg: string;
  data: {
    fileName: string;
    fileType: string;
  };
}

export interface RunningHubCreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    taskStatus: string;
  };
}

export interface RunningHubTaskStatusResponse {
  code: number;
  msg: string;
  data: string | {
    taskId: string;
    taskStatus: string;
    output?: string[];
    error?: string;
  };
}

export interface RunningHubTaskResultResponse {
  code: number;
  msg: string;
  data: Array<{
    fileUrl: string;
    [key: string]: any;
  }>;
}

export interface ClothingTryonRequest {
  userPhotoUrl: string; // 全身自拍照（必选）- R2 URL
  topClothesUrl?: string; // 上衣图片（可选）- R2 URL
  bottomClothesUrl?: string; // 下衣图片（可选）- R2 URL
}

class RunningHubService {
  private baseUrl: string;
  private apiKey: string;
  private singleItemWorkflowId: string;
  private topBottomWorkflowId: string;
  private s3Service: S3Service;

  constructor() {
    this.baseUrl = env.RUNNINGHUB_API_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.RUNNINGHUB_API_KEY;
    this.singleItemWorkflowId = env.RUNNINGHUB_SINGLE_ITEM_WORKFLOW_ID;
    this.topBottomWorkflowId = env.RUNNINGHUB_TOP_BOTTOM_WORKFLOW_ID;

    // 初始化 S3Service 用于 R2 操作
    // R2 需要使用 'auto' 作为 region
    this.s3Service = new S3Service({
      endpoint: env.R2_ENDPOINT,
      region: env.R2_REGION || 'auto',
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      url: env.R2_URL_BASE,
      bucket: env.R2_BUCKET,
    });
  }

  /**
   * 从 R2 URL 下载文件并上传到 RunningHub
   */
  async uploadFileFromR2Url(
    r2Url: string,
    fileType: "image" | "zip" | "video" | "audio" = "image"
  ): Promise<string> {
    try {
      console.log(`📥 从 R2 下载文件: ${r2Url}`);

      // 下载文件
      const response = await axios.get(r2Url, {
        responseType: "arraybuffer",
        timeout: 120000, // 120秒超时
      });

      const fileBuffer = Buffer.from(response.data);
      const contentType = response.headers["content-type"] || "image/jpeg";
      const fileName = this.extractFileNameFromUrl(r2Url) || `upload_${Date.now()}.jpg`;

      console.log(`✅ 文件下载完成: ${fileName}, 大小: ${fileBuffer.length} bytes`);

      // 上传到 RunningHub
      return await this.uploadFile(fileBuffer, {
        fileType,
        filename: fileName,
        contentType,
      });
    } catch (error: any) {
      console.error("❌ 从 R2 下载并上传到 RunningHub 失败:", error.message);
      throw new Error(`上传文件失败: ${error.message}`);
    }
  }

  /**
   * 直接上传文件 Buffer 到 RunningHub
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: {
      fileType: "image" | "zip" | "video" | "audio";
      filename: string;
      contentType: string;
    }
  ): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          const waitSeconds = 2 * attempt;
          console.log(`🔄 第 ${attempt} 次尝试上传，等待 ${waitSeconds} 秒...`);
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        }

        const formData = new FormData();
        formData.append("apiKey", this.apiKey);
        formData.append("file", fileBuffer, {
          filename: options.filename,
          contentType: options.contentType,
        });
        formData.append("fileType", options.fileType);

        console.log(`📤 上传文件到 RunningHub:`, {
          url: `${this.baseUrl}/task/openapi/upload`,
          filename: options.filename,
          fileSize: fileBuffer.length,
          contentType: options.contentType,
        });

        const response = await axios.post(
          `${this.baseUrl}/task/openapi/upload`,
          formData,
          {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000, // 120秒超时
          }
        );

        const result: RunningHubUploadResponse = response.data;

        if (result.code === 0 && result.data?.fileName) {
          console.log(`✅ 上传成功，文件名: ${result.data.fileName}`);
          return result.data.fileName;
        } else {
          throw new Error(result.msg || "上传失败");
        }
      } catch (error: any) {
        lastError = error;
        const isTimeout =
          error.message?.includes("504") ||
          error.message?.includes("超时") ||
          error.code === "ECONNABORTED";
        const isNetworkError =
          error.message?.includes("ECONNRESET") ||
          error.message?.includes("ETIMEDOUT") ||
          error.message?.includes("ENOTFOUND");

        if ((isTimeout || isNetworkError) && attempt < MAX_RETRIES) {
          console.warn(`⚠️ 上传失败（${error.message}），将重试...`);
          continue;
        } else {
          if (attempt >= MAX_RETRIES) {
            console.error(`❌ 已重试 ${MAX_RETRIES} 次，放弃上传`);
          }
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * 创建 clothing-tryon 工作流任务
   */
  async createClothingTryonTask(
    request: ClothingTryonRequest,
    webhookUrl?: string
  ): Promise<{ taskId: string; taskStatus: string }> {
    try {
      // 上传用户照片（必选）
      console.log("📤 上传用户照片...");
      const userPhotoFilename = await this.uploadFileFromR2Url(
        request.userPhotoUrl,
        "image"
      );

      // 上传上衣（如果提供）
      let topClothesFilename: string | undefined;
      if (request.topClothesUrl) {
        console.log("📤 上传上衣图片...");
        topClothesFilename = await this.uploadFileFromR2Url(
          request.topClothesUrl,
          "image"
        );
      }

      // 上传下衣（如果提供）
      let bottomClothesFilename: string | undefined;
      if (request.bottomClothesUrl) {
        console.log("📤 上传下衣图片...");
        bottomClothesFilename = await this.uploadFileFromR2Url(
          request.bottomClothesUrl,
          "image"
        );
      }

      // 验证至少提供了一件衣服
      if (!topClothesFilename && !bottomClothesFilename) {
        throw new Error("至少需要提供上衣或下衣中的一件");
      }

      // 根据上传的衣服数量选择工作流ID
      const hasBoth = topClothesFilename && bottomClothesFilename;
      const workflowId = hasBoth
        ? this.topBottomWorkflowId
        : this.singleItemWorkflowId;

      console.log(`🚀 启动工作流:`, {
        workflowId,
        isSingleItem: !hasBoth,
        userPhotoFilename,
        topClothesFilename,
        bottomClothesFilename,
      });

      // 构造节点信息列表
      // 节点ID从环境变量读取，可在 .env.local 中配置
      const NODE_USER_PHOTO = env.RUNNINGHUB_NODE_USER_PHOTO;
      const NODE_TOP_CLOTHES = env.RUNNINGHUB_NODE_TOP_CLOTHES;
      const NODE_BOTTOM_CLOTHES = env.RUNNINGHUB_NODE_BOTTOM_CLOTHES;

      const nodeInfoList = [
        {
          nodeId: NODE_USER_PHOTO,
          fieldName: "image",
          fieldValue: userPhotoFilename,
        },
      ];

      if (hasBoth) {
        // 同时上传上衣和下衣
        if (topClothesFilename) {
          nodeInfoList.push({
            nodeId: NODE_TOP_CLOTHES,
            fieldName: "image",
            fieldValue: topClothesFilename,
          });
        }
        if (bottomClothesFilename) {
          nodeInfoList.push({
            nodeId: NODE_BOTTOM_CLOTHES,
            fieldName: "image",
            fieldValue: bottomClothesFilename,
          });
        }
      } else {
        // 单件上传（上衣或下衣都使用 NODE_TOP_CLOTHES）
        const clothesFilename = topClothesFilename || bottomClothesFilename;
        if (clothesFilename) {
          nodeInfoList.push({
            nodeId: NODE_TOP_CLOTHES,
            fieldName: "image",
            fieldValue: clothesFilename,
          });
        }
      }

      const payload: any = {
        apiKey: this.apiKey,
        workflowId: workflowId,
        nodeInfoList: nodeInfoList,
      };

      if (webhookUrl) {
        payload.webhookUrl = webhookUrl;
      }

      console.log(`🚀 创建 RunningHub 任务:`, {
        url: `${this.baseUrl}/task/openapi/create`,
        workflowId,
        nodeInfoList,
      });

      const response = await axios.post(
        `${this.baseUrl}/task/openapi/create`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const result: RunningHubCreateTaskResponse = response.data;

      if (result.code === 0 && result.data?.taskId) {
        console.log(`✅ 任务创建成功:`, {
          taskId: result.data.taskId,
          status: result.data.taskStatus,
        });
        return {
          taskId: result.data.taskId,
          taskStatus: result.data.taskStatus,
        };
      } else {
        throw new Error(result.msg || "创建任务失败");
      }
    } catch (error: any) {
      console.error("❌ 创建 RunningHub 任务失败:", error.message);
      throw new Error(`创建任务失败: ${error.message}`);
    }
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<RunningHubTaskStatusResponse> {
    try {
      const payload = {
        apiKey: this.apiKey,
        taskId: taskId,
      };

      const response = await axios.post(
        `${this.baseUrl}/task/openapi/status?t=${Date.now()}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          timeout: 30000,
        }
      );

      const result = response.data;

      // 处理不同的响应格式
      if (typeof result.code !== "number") {
        return result;
      }

      if (result.code !== 0) {
        throw new Error(result.msg || "查询任务状态失败");
      }

      // 如果 data 是字符串，转换为对象格式
      if (typeof result.data === "string") {
        return {
          code: 0,
          msg: "success",
          data: {
            taskId: taskId,
            taskStatus: result.data,
          },
        };
      }

      return result;
    } catch (error: any) {
      console.error("❌ 查询任务状态失败:", error.message);
      throw new Error(`查询任务状态失败: ${error.message}`);
    }
  }

  /**
   * 查询任务结果
   */
  async getTaskResult(taskId: string): Promise<RunningHubTaskResultResponse> {
    try {
      const payload = {
        apiKey: this.apiKey,
        taskId: taskId,
      };

      const response = await axios.post(
        `${this.baseUrl}/task/openapi/outputs?t=${Date.now()}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          timeout: 30000,
        }
      );

      const result: RunningHubTaskResultResponse = response.data;

      if (result.code !== 0) {
        if (result.code === 804 && result.msg === "APIKEY_TASK_IS_RUNNING") {
          return {
            code: 804,
            msg: "APIKEY_TASK_IS_RUNNING",
            data: [],
          };
        }
        throw new Error(result.msg || "获取任务结果失败");
      }

      return result;
    } catch (error: any) {
      console.error("❌ 获取任务结果失败:", error.message);
      throw new Error(`获取任务结果失败: ${error.message}`);
    }
  }

  /**
   * 下载任务结果并上传到 R2
   */
  async downloadTaskResultAndUploadToR2(
    taskId: string,
    fluxDataId: number
  ): Promise<string> {
    try {
      // 获取任务结果
      const result = await this.getTaskResult(taskId);

      if (!result.data || result.data.length === 0) {
        throw new Error("任务结果为空");
      }

      const resultUrl = result.data[0].fileUrl;
      console.log(`📥 下载任务结果: ${resultUrl}`);

      // 下载结果图片
      const imageResponse = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
      });

      const fileBuffer = Buffer.from(imageResponse.data);
      const contentType = imageResponse.headers["content-type"] || "image/jpeg";

      // 生成 R2 文件名
      const fileExtension = this.extractFileExtension(resultUrl) || ".jpg";
      const r2Key = `clothing-tryon/${fluxDataId}/result${fileExtension}`;

      // 上传到 R2
      console.log(`📤 上传结果到 R2: ${r2Key}`);
      const uploadResult = await this.s3Service.putItemInBucket(
        `result${fileExtension}`,
        fileBuffer,
        {
          path: `clothing-tryon/${fluxDataId}`,
          ContentType: contentType,
          acl: "public-read",
        }
      );

      console.log(`✅ 结果上传到 R2 成功: ${uploadResult.completedUrl}`);
      return uploadResult.completedUrl;
    } catch (error: any) {
      console.error("❌ 下载任务结果并上传到 R2 失败:", error.message);
      throw new Error(`处理任务结果失败: ${error.message}`);
    }
  }

  /**
   * 从 URL 中提取文件名
   */
  private extractFileNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop();
      return filename || null;
    } catch {
      return null;
    }
  }

  /**
   * 从 URL 中提取文件扩展名
   */
  private extractFileExtension(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([^.]+)$/);
      return match ? `.${match[1]}` : null;
    } catch {
      return null;
    }
  }
}

export const runningHubService = new RunningHubService();

