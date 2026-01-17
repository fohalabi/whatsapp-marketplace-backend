// controllers/broadcast.controller.ts
import { Request, Response } from 'express';
import { broadcastService } from '../services/broadcast.service';
import { 
  CreateTemplateDTO, 
  UpdateTemplateDTO, 
  SubmitTemplateDTO,
  CreateBroadcastDTO,
  UpdateBroadcastDTO
} from '../types/broadcast.types';

export class BroadcastController {
  
  async createTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      const result = await broadcastService.createTemplate(req.body as CreateTemplateDTO, userId);
      
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getTemplates(req: Request, res: Response) {
    try {
      const {
        approvalStatus,
        category,
        search,
        page = '1',
        limit = '20'
      } = req.query;

      const params = {
        approvalStatus: approvalStatus as string | undefined,
        category: category as string | undefined,
        search: search as string | undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await broadcastService.getTemplates(params);
      
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      const result = await broadcastService.getTemplate(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      const result = await broadcastService.updateTemplate(
        id, 
        req.body as UpdateTemplateDTO, 
        userId
      );
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      const result = await broadcastService.deleteTemplate(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async submitTemplateForApproval(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      const result = await broadcastService.submitTemplateForApproval(
        id, 
        req.body as SubmitTemplateDTO
      );
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createBroadcast(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      const result = await broadcastService.createBroadcast(
        req.body as CreateBroadcastDTO, 
        userId
      );
      
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getBroadcasts(req: Request, res: Response) {
    try {
      const {
        status,
        approvalStatus,
        search,
        page = '1',
        limit = '20'
      } = req.query;

      const params = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        ...(status && { status: status as string }),
        ...(approvalStatus && { approvalStatus: approvalStatus as string }),
        ...(search && { search: search as string })
      };

      const result = await broadcastService.getBroadcasts(params);
      
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.getBroadcast(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.updateBroadcast(
        id, 
        req.body as UpdateBroadcastDTO, 
        userId
      );
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async submitBroadcastForApproval(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.submitBroadcastForApproval(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async approveBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const approvedBy = (req as any).user?.id;
      
      if (!approvedBy) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.approveBroadcast(id, approvedBy);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async rejectBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.rejectBroadcast(id, rejectionReason);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async sendBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.sendBroadcast(id);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Broadcast sending initiated',
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getBroadcastStats(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.getBroadcastStats(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async cancelBroadcast(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Broadcast ID is required'
        });
      }

      const result = await broadcastService.cancelBroadcast(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Broadcast not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createSegment(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      const result = await broadcastService.createSegment(req.body, userId);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Segment created successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getSegments(req: Request, res: Response) {
    try {
      const {
        search,
        page = '1',
        limit = '20',
        tags
      } = req.query;

      const params = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        ...(search && { search: search as string }),
        ...(tags && { tags: (tags as string).split(',') })
      };

      const result = await broadcastService.getSegments(params);
      
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getSegment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Segment ID is required'
        });
      }

      const result = await broadcastService.getSegment(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Segment not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateSegment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Segment ID is required'
        });
      }

      const result = await broadcastService.updateSegment(id, req.body, userId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Segment updated successfully',
      });
    } catch (error: any) {
      if (error.message === 'Segment not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteSegment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Segment ID is required'
        });
      }

      const result = await broadcastService.deleteSegment(id);
      
      res.status(200).json({
        success: true,
        message: 'Segment deleted successfully',
      });
    } catch (error: any) {
      if (error.message === 'Segment not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async estimateSegmentSize(req: Request, res: Response) {
    try {
      const { criteria } = req.body;
      const count = await broadcastService.estimateSegmentSize(criteria);
      
      res.status(200).json({
        success: true,
        data: { count },
        message: 'Segment size estimated',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getSegmentStats(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Segment ID is required'
        });
      }

      const result = await broadcastService.getSegmentStats(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Segment not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async duplicateSegment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newName } = req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required',
        });
      }

      if (!newName) {
        return res.status(400).json({
          success: false,
          message: 'New name is required',
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Segment ID is required'
        });
      }

      const result = await broadcastService.duplicateSegment(id, newName, userId);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Segment duplicated successfully',
      });
    } catch (error: any) {
      if (error.message === 'Segment not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getSegmentTags(req: Request, res: Response) {
    try {
      const tags = await broadcastService.getSegmentTags();
      
      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}



// Export singleton
export const broadcastController = new BroadcastController();
export default broadcastController;