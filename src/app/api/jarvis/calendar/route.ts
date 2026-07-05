import { json } from "@/lib/json-response";
import {
  getEvents, getEventsForDate, getUpcomingEvents, addEvent, deleteEvent,
} from "@/lib/calendar-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "upcoming") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      return json({ events: getUpcomingEvents(limit) });
    }

    // ?date=YYYY-MM-DD or default to today
    const dateParam = url.searchParams.get("date");
    const dateStr = dateParam
      ? dateParam
      : new Date().toISOString().slice(0, 10);

    const events = getEventsForDate(dateStr);
    return json({ events, date: dateStr });
  } catch (error) {
    console.error("calendar GET error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to fetch events" },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, start, end, description, color } = body;

    if (!title?.trim() || !start) {
      return json({ error: "title and start are required" }, 400);
    }

    const ev = addEvent({
      title: title.trim(),
      start,
      end: end || start,
      description: description?.trim() || "",
      color: color || "cyan",
    });

    return json({ event: ev }, 201);
  } catch (error) {
    console.error("calendar POST error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to create event" },
      500
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ error: "id query parameter is required" }, 400);
    }

    const success = deleteEvent(id);
    if (!success) {
      return json({ error: "Event not found" }, 404);
    }

    return json({ success: true });
  } catch (error) {
    console.error("calendar DELETE error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to delete event" },
      500
    );
  }
}