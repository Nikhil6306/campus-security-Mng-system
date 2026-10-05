import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit() {
    this.logger.log('Realtime Socket.IO Gateway initialized.');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  // Broadcasters for system events
  emitVisitorCreated(data: any) {
    this.server.emit('visitor.created', data);
  }

  emitVisitorApproved(data: any) {
    this.server.emit('visitor.approved', data);
  }

  emitVisitorRejected(data: any) {
    this.server.emit('visitor.rejected', data);
  }

  emitVisitorCheckedIn(data: any) {
    this.server.emit('visitor.checked_in', data);
    this.server.emit('gate.entry', data);
  }

  emitVisitorCheckedOut(data: any) {
    this.server.emit('visitor.checked_out', data);
    this.server.emit('gate.exit', data);
  }

  emitIncidentCreated(data: any) {
    this.server.emit('incident.created', data);
  }

  emitIncidentUpdated(data: any) {
    this.server.emit('incident.updated', data);
  }

  emitShiftStarted(data: any) {
    this.server.emit('guard.shift.started', data);
  }

  emitShiftEnded(data: any) {
    this.server.emit('guard.shift.ended', data);
  }
}
