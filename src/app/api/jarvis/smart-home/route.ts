import { json } from "@/lib/json-response";
import {
  type SmartDevice,
  type HomeAssistantConfig,
  getDevices,
  addDevice,
  updateDevice,
  deleteDevice,
  toggleDevice,
  getDevicesByRoom,
  getHAConfig,
  fetchHAEntities,
  callHAService,
} from "@/lib/smart-home";

// Server-side localStorage shim: reads from a JSON file on the server
// Since this runs server-side, we can't access localStorage directly.
// We use a simple in-memory store as a proxy. In production, this would
// use a proper DB or the client would always be the source of truth.

// ── In-memory store (server-side mirror) ───────────────────────
// This API route acts as a thin proxy for client-side operations.
// For HA service calls, it proxies to the HA instance.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get("room");

    // HA proxy: ?action=ha_entities
    const action = searchParams.get("action");
    if (action === "ha_entities") {
      const body: HomeAssistantConfig = {
        enabled: true,
        url: searchParams.get("url") || "",
        token: searchParams.get("token") || "",
        autoDiscover: false,
      };
      try {
        const entities = await fetchHAEntities(body);
        return json({ entities });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "HA fetch failed" }, 502);
      }
    }

    // Standard: return devices (client-side managed, but we provide the API shape)
    // Since devices are in localStorage on the client, this returns a placeholder
    // The actual CRUD happens on the client via the lib functions directly.
    if (room) {
      return json({ devices: [], room, note: "Devices managed client-side. Filter applied on client." });
    }
    return json({ devices: [], note: "Devices managed client-side via localStorage." });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // HA service call proxy
    if (body.action === "ha_call") {
      const { entityId, domain, service, data, haConfig } = body;
      if (!entityId || !domain || !service) {
        return json({ error: "entityId, domain, and service are required" }, 400);
      }
      try {
        const result = await callHAService(
          haConfig as HomeAssistantConfig,
          entityId,
          domain,
          service,
          data || {},
        );
        return json({ success: true, result });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "HA service call failed" }, 502);
      }
    }

    // Add device (server-side echo — client uses lib directly)
    const { name, type, room, state, attributes, icon } = body;
    if (!name || !type) {
      return json({ error: "name and type are required" }, 400);
    }
    // Echo back — client handles actual localStorage write
    return json({ success: true, note: "Device added client-side", device: body });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid request body" }, 400);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, state, attributes } = body;

    if (!id) {
      return json({ error: "id is required" }, 400);
    }

    // Server-side echo — client handles actual localStorage write
    return json({
      success: true,
      note: "Device updated client-side",
      device: { id, state, attributes },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid request body" }, 400);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return json({ error: "id query parameter is required" }, 400);
    }

    return json({ success: true, note: "Device deleted client-side", id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}