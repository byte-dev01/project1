// Contact.js
import React from 'react';
import './Contact.css'; // Put your CSS in a separate file

const Contact = () => {
  return (
    <>
      {/* Header Banner */}
      <div className="header-banner">
        UCLA Office of the Chancellor
      </div>

      {/* Main Content */}
      <main className="container">
        <nav className="breadcrumb">
          <a href="/">Home</a>
        </nav>

        <h1>Contact</h1>
        <hr className="separator" />

        <div className="content">
          <p>
            Please direct general inquiries for the Office of the Chancellor to <a href="mailto:chancellor@ucla.edu">chancellor@ucla.edu</a>.
          </p>

          <p>
            Email sent to the Chancellor's Office may be read and answered by members of his staff or other university personnel. Responses will indicate who is responding to you.
          </p>

          <div className="contact-details">
            <strong>U.S. Mail</strong>
            <br /> UCLA Chancellor's Office
            <br /> Box 951405, 2147 Murphy Hall
            <br /> Los Angeles, CA 90095-1405

            <br /><strong>Campus Mail</strong>
            <br /> 2147 Murphy Hall
            <br /> Mailcode: 140501

            <br /><strong>Phone</strong>
            <br /> (310) 825-2151

            <br /><strong>Fax</strong>
            <br /> (310) 206-6030
          </div>

          <p>
            Please be aware that the Chancellor's Communication Service retains copies of all correspondence, and all correspondence is considered a matter of public record.
          </p>
        </div>

        <h2>Support Staff</h2>
        <p>
          The chancellor's support staff manages the daily requirements of the office, including communications, contacts, calendar, travel, public outreach, conflict resolution, research and other professional activities...
        </p>

        <div className="staff-info">
          Julie Sina<br />
          Chief of Staff<br />
          <a href="mailto:jsina@conet.ucla.edu">jsina@conet.ucla.edu</a>
        </div>

        <h2>Campus Leadership</h2>
        <p>
          To learn more about and to contact other members of UCLA leadership, <a href="https://www.ucla.edu/about/leadership">click here.</a>
        </p>
      </main>
    </>
  );
};

export default Contact;
